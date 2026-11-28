import AsyncStorage from '@react-native-async-storage/async-storage';

import { getActiveAccountId } from '@/lib/account-cache';
import { clearDeviceId } from '@/lib/device';
import { deleteAllBookingMedia, deleteDraftMedia } from '@/lib/media';
import { endSession } from '@/store/session';

/**
 * Device cleanup that follows a server-side account deletion: removes every Gabfix
 * cache key on this device, deletes the photos/videos kept for drafts and bookings,
 * clears the device identifier, then clears the session (keychain token included).
 * The account itself is deleted by `POST /account/delete` first; this only clears
 * what the device still holds.
 */
export async function deleteLocalAccount(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    // Only this account's cache namespace plus the device-level keys; another
    // account's cached objects stay untouched on this device.
    const accountId = getActiveAccountId();
    const suffix = accountId ? `::${encodeURIComponent(accountId)}` : null;
    const owned = suffix ? keys.filter((key) => key.endsWith(suffix)) : [];
    const globalKeys = keys.filter((key) => key.startsWith('gabfix.') && !key.includes('::'));
    const remove = Array.from(new Set([...owned, ...globalKeys]));
    if (remove.length > 0) await AsyncStorage.multiRemove(remove);
  } catch {
    // The session still needs to be cleared even if cache cleanup fails.
  }
  deleteDraftMedia();
  deleteAllBookingMedia();
  try {
    await clearDeviceId();
  } catch {
    // Best-effort.
  }
  await endSession();
}
