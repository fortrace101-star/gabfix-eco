import * as FileSystem from 'expo-file-system/legacy';

import { env } from './env';
import { supabase } from './supabase';

export type ChatUploadTarget = {
  path: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAtISO: string;
};

/**
 * The API issues one signed PUT for an attachment, exactly like the customer
 * app, so both sides share the same size/duration limits.
 */
async function requestTarget(
  threadId: string,
  input: { kind: 'image' | 'video'; mimeType: string; bytes: number; durationMs?: number },
): Promise<ChatUploadTarget> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in again to send attachments.');

  const response = await fetch(`${env.supabaseUrl}/functions/v1/api/threads/${threadId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const payload = (await response.json().catch(() => null)) as
    | { upload?: ChatUploadTarget; error?: { message?: string } }
    | null;
  if (!response.ok || !payload?.upload) {
    throw new Error(payload?.error?.message ?? 'Could not prepare that attachment.');
  }
  return payload.upload;
}

/** Uploads the file, then returns its storage path for the message row. */
export async function uploadChatAttachment(
  threadId: string,
  asset: { uri: string; kind: 'image' | 'video'; mimeType: string; bytes: number; durationMs?: number },
): Promise<string> {
  const target = await requestTarget(threadId, {
    kind: asset.kind,
    mimeType: asset.mimeType,
    bytes: asset.bytes,
    durationMs: asset.durationMs,
  });

  const result = await FileSystem.uploadAsync(target.uploadUrl, asset.uri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: target.headers,
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error('The attachment did not upload. Try again.');
  }
  return target.path;
}
