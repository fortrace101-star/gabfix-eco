import * as FileSystem from 'expo-file-system/legacy';

import type { UploadTarget } from '@/lib/api/bookings';
import { apiRequest } from '@/lib/api/client';
import { hasApiBaseUrl } from '@/lib/config';
import type { BookingMediaItem } from '@/lib/pricing';
import { enqueueUploads, updateUpload } from '@/store/media-uploads';

/**
 * Upload queue (3.11). `POST /bookings` issues one signed target per attachment;
 * the queue PUTs bytes to the target, then confirms with `/media/:id/complete`.
 * Targets are cached per booking so the confirmation screen can start the queue
 * without re-issuing metadata rows. An expired link is refreshed through
 * `/media/:id/refresh` on the next attempt. With no backend configured, files
 * are moved by `finalizeDraftMedia` and marked uploaded so P14/P15b show the
 * finished state. Set EXPO_PUBLIC_MOCK_UPLOAD_FAIL=2 in development to fail the
 * second item.
 */

const RETRY_DELAYS = [2000, 8000, 30000];
const TARGET_EXPIRY_MARGIN_MS = 60_000;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const targetCache = new Map<string, UploadTarget[]>();

/** Keeps the targets returned by `POST /bookings` for the upload queue. */
export function rememberUploadTargets(bookingId: string, targets?: UploadTarget[]): void {
  if (targets && targets.length > 0) targetCache.set(bookingId, targets);
}

const targetFor = (targets: UploadTarget[] | undefined, clientId: string) =>
  targets?.find((candidate) => candidate.clientId === clientId);

const isFresh = (target: UploadTarget | undefined) =>
  Boolean(target && Date.parse(target.expiresAtISO) - Date.now() > TARGET_EXPIRY_MARGIN_MS);

export function prepareBookingUploads(bookingId: string, items: BookingMediaItem[]) {
  const targets = targetCache.get(bookingId);
  enqueueUploads(
    items.map((item) => ({
      bookingId,
      clientId: item.id,
      mediaId: targetFor(targets, item.id)?.mediaId ?? item.id,
      uri: item.uri,
      kind: item.kind,
      mimeType: item.mimeType,
      bytes: item.sizeBytes,
      state: 'queued' as const,
      progress: 0,
      attempts: 0,
      updatedAtISO: new Date().toISOString(),
    })),
  );
}

type UploadLink = Pick<UploadTarget, 'uploadUrl' | 'headers' | 'expiresAtISO'>;

/** Refresh issues a new signed PUT link for an attachment that has not landed yet. */
async function refreshTarget(bookingId: string, mediaId: string): Promise<UploadLink | null> {
  try {
    const result = await apiRequest<{ upload: UploadLink }>(
      `/bookings/${bookingId}/media/${mediaId}/refresh`,
      { method: 'POST' },
    );
    return result.upload;
  } catch {
    return null;
  }
}

async function uploadOne(
  bookingId: string,
  clientId: string,
  mediaId: string,
  uri: string,
  initial?: UploadTarget,
): Promise<boolean> {
  if (!hasApiBaseUrl) {
    await sleep(120);
    updateUpload(bookingId, clientId, { state: 'uploaded', progress: 1 });
    return true;
  }

  let link: UploadLink | undefined = isFresh(initial) ? initial : undefined;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt += 1) {
    updateUpload(bookingId, clientId, {
      state: 'uploading',
      attempts: attempt + 1,
      error: undefined,
    });

    if (!link) {
      const refreshed = await refreshTarget(bookingId, mediaId);
      if (!refreshed) {
        updateUpload(bookingId, clientId, {
          state: 'failed',
          error: 'The upload link expired. Tap retry to get a new one.',
        });
        return false;
      }
      link = refreshed;
    }

    let retryNow = false;
    try {
      const task = FileSystem.createUploadTask(
        link.uploadUrl,
        uri,
        {
          httpMethod: 'PUT',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: link.headers,
        },
        ({ totalBytesSent, totalBytesExpectedToSend }) => {
          if (totalBytesExpectedToSend > 0) {
            updateUpload(bookingId, clientId, {
              progress: Math.min(1, totalBytesSent / totalBytesExpectedToSend),
            });
          }
        },
      );
      const result = await task.uploadAsync();
      if (result && result.status >= 200 && result.status < 300) {
        try {
          await apiRequest(`/bookings/${bookingId}/media/${mediaId}/complete`, { method: 'POST' });
        } catch {
          updateUpload(bookingId, clientId, {
            state: 'failed',
            progress: 1,
            error: 'The file uploaded but could not be saved. Tap retry.',
          });
          return false;
        }
        updateUpload(bookingId, clientId, { state: 'uploaded', progress: 1, mediaId });
        return true;
      }
      // 410/401/403 means the signed link is gone; ask for a new one.
      if (result && [401, 403, 410].includes(result.status)) {
        link = undefined;
        retryNow = true;
      }
    } catch {
      // Fall through to the back-off below.
    }

    if (retryNow) {
      if (attempt < RETRY_DELAYS.length) {
        await sleep(500);
        continue;
      }
    } else if (attempt < RETRY_DELAYS.length) {
      await sleep(RETRY_DELAYS[attempt]);
    }
  }

  updateUpload(bookingId, clientId, {
    state: 'failed',
    error: 'We could not upload this item. Check your connection and try again.',
  });
  return false;
}

/** Starts the queue for one booking. Never blocks navigation; callers do not await it. */
export async function startBookingUploads(
  bookingId: string,
  items: BookingMediaItem[],
  targets?: UploadTarget[],
): Promise<void> {
  if (targets) rememberUploadTargets(bookingId, targets);
  const available = targets ?? targetCache.get(bookingId);
  const mockFailIndex = Number(process.env.EXPO_PUBLIC_MOCK_UPLOAD_FAIL ?? 0);

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (mockFailIndex === index + 1 && !hasApiBaseUrl) {
      updateUpload(bookingId, item.id, {
        state: 'failed',
        attempts: 3,
        error: 'We could not upload this item. Check your connection and try again.',
      });
      continue;
    }
    const target = targetFor(available, item.id);
    await uploadOne(bookingId, item.id, target?.mediaId ?? item.id, item.uri, target);
  }
}

/** Retry button on P14/P15b: only re-uploads items currently marked failed. */
export async function retryBookingUploads(bookingId: string, items: BookingMediaItem[]): Promise<void> {
  const { getUploadState } = await import('@/store/media-uploads');
  const failedIds = new Set(
    getUploadState()
      .items.filter((item) => item.bookingId === bookingId && item.state === 'failed')
      .map((item) => item.clientId),
  );
  const toRetry = items.filter((item) => failedIds.has(item.id));
  if (toRetry.length === 0) return;
  await startBookingUploads(bookingId, toRetry);
}
