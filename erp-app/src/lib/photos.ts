import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

export type PhotoKind = 'before' | 'after';

export type PendingPhoto = {
  id: string;
  bookingId: string;
  kind: PhotoKind;
  uri: string;
  fileName: string;
  mimeType: string;
  createdAt: string;
};

const QUEUE_KEY = 'gabfix.portal.photo-queue';

const randomId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

async function readQueue(): Promise<PendingPhoto[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const parsed = raw ? (JSON.parse(raw) as PendingPhoto[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: PendingPhoto[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function pendingPhotosFor(bookingId: string): Promise<number> {
  const queue = await readQueue();
  return queue.filter((item) => item.bookingId === bookingId).length;
}

/** Camera or library; the picker compresses to a JPEG at quality 0.6. */
export async function pickPhoto(source: 'camera' | 'library'): Promise<PendingPhoto['uri'] | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Camera access is turned off for this app.');
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      allowsEditing: false,
      exif: false,
    });
    return result.canceled ? null : (result.assets[0]?.uri ?? null);
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Photo library access is turned off for this app.');
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.6,
    allowsMultipleSelection: false,
    exif: false,
  });
  return result.canceled ? null : (result.assets[0]?.uri ?? null);
}

/** Library video for the inspection report, capped so uploads stay under the bucket limit. */
export async function pickVideo(): Promise<{ uri: string; mimeType: string } | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Video library access is turned off for this app.');
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    videoMaxDuration: 90,
    allowsMultipleSelection: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  return { uri: asset.uri, mimeType: asset.mimeType ?? 'video/mp4' };
}

async function uploadPhoto(
  photo: PendingPhoto,
  uploaderId: string | null,
): Promise<void> {
  const path = `${photo.bookingId}/${photo.kind}/${photo.id}.jpg`;
  const response = await fetch(photo.uri);
  const body = await response.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from('job-photos')
    .upload(path, body, { contentType: photo.mimeType, upsert: false });

  if (uploadError) throw new Error(uploadError.message);

  const { error: rowError } = await supabase.from('job_photos').insert({
    booking_id: photo.bookingId,
    storage_path: path,
    kind: photo.kind,
    uploaded_by: uploaderId,
  });

  if (rowError) {
    await supabase.storage.from('job-photos').remove([path]);
    throw new Error(rowError.message);
  }
}

/** Upload now; if the network is down the photo is kept in the queue for a later retry. */
export async function savePhoto(params: {
  bookingId: string;
  kind: PhotoKind;
  uri: string;
  uploaderId: string | null;
}): Promise<{ queued: boolean }> {
  const photo: PendingPhoto = {
    id: randomId(),
    bookingId: params.bookingId,
    kind: params.kind,
    uri: params.uri,
    fileName: `${params.kind}.jpg`,
    mimeType: 'image/jpeg',
    createdAt: new Date().toISOString(),
  };

  try {
    await uploadPhoto(photo, params.uploaderId);
    return { queued: false };
  } catch (uploadError) {
    const queue = await readQueue();
    await writeQueue([...queue.filter((item) => item.id !== photo.id), photo]);
    throw uploadError instanceof Error ? uploadError : new Error(String(uploadError));
  }
}

/** Try every queued upload once. Returns how many landed and how many are still waiting. */
export async function flushPhotoQueue(
  uploaderId: string | null,
): Promise<{ uploaded: number; remaining: number }> {
  const queue = await readQueue();
  if (!queue.length) return { uploaded: 0, remaining: 0 };

  const remaining: PendingPhoto[] = [];
  let uploaded = 0;

  for (const photo of queue) {
    try {
      await uploadPhoto(photo, uploaderId);
      uploaded += 1;
    } catch {
      remaining.push(photo);
    }
  }

  await writeQueue(remaining);
  return { uploaded, remaining: remaining.length };
}
