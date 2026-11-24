import NetInfo from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { flushActionQueue } from '@/lib/action-queue';
import { flushPhotoQueue } from '@/lib/photos';
import { useAuth } from '@/store/auth';

/**
 * Replays queued technician actions and photo uploads when the app starts and whenever the device
 * comes back online, then refreshes the queries so the UI reflects what the server accepted.
 */
export function SyncManager() {
  const { profile, status } = useAuth();
  const queryClient = useQueryClient();
  const profileId = profile?.id ?? null;

  useEffect(() => {
    if (status !== 'signedIn') return;

    let cancelled = false;
    const run = async () => {
      const actions = await flushActionQueue();
      const photos = await flushPhotoQueue(profileId);
      if (cancelled) return;
      if (actions.done || photos.uploaded) await queryClient.invalidateQueries();
    };

    void run();

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) void run();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [status, profileId, queryClient]);

  return null;
}
