import { supabase } from '@/lib/supabase';

/**
 * Photos and video attached to an inspection visit. They land in the private
 * `inspection-media` bucket at `<inspection_id>/<file>` so the storage policy can
 * resolve which inspection a path belongs to (F3).
 */

export type InspectionMediaKind = 'photo' | 'video';

export type InspectionMediaItem = {
  id: string;
  kind: InspectionMediaKind;
  storagePath: string;
  caption: string | null;
  url: string | null;
};

export async function listInspectionMedia(inspectionId: string): Promise<InspectionMediaItem[]> {
  const { data, error } = await supabase
    .from('inspection_media')
    .select('id, kind, storage_path, caption')
    .eq('inspection_id', inspectionId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (!rows.length) return [];

  const { data: signed } = await supabase.storage
    .from('inspection-media')
    .createSignedUrls(
      rows.map((row) => row.storage_path),
      60 * 60,
    );

  const urls = new Map((signed ?? []).map((entry) => [entry.path, entry.signedUrl]));
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind === 'video' ? 'video' : 'photo',
    storagePath: row.storage_path,
    caption: row.caption,
    url: urls.get(row.storage_path) ?? null,
  }));
}

export async function addInspectionMedia(params: {
  inspectionId: string;
  uri: string;
  kind: InspectionMediaKind;
  mimeType: string;
  uploaderId: string | null;
  caption?: string;
}): Promise<void> {
  const extension =
    params.kind === 'video'
      ? /quicktime|mov/i.test(params.mimeType)
        ? 'mov'
        : 'mp4'
      : /png/i.test(params.mimeType)
        ? 'png'
        : /webp/i.test(params.mimeType)
          ? 'webp'
          : 'jpg';
  const file = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  const path = `${params.inspectionId}/${file}`;
  const response = await fetch(params.uri);
  const body = await response.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from('inspection-media')
    .upload(path, body, { contentType: params.mimeType, upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  const { error: rowError } = await supabase.from('inspection_media').insert({
    inspection_id: params.inspectionId,
    storage_path: path,
    kind: params.kind,
    caption: params.caption?.trim() || null,
    taken_at: new Date().toISOString(),
    uploaded_by: params.uploaderId,
  });

  if (rowError) {
    await supabase.storage.from('inspection-media').remove([path]);
    throw new Error(rowError.message);
  }
}

export async function removeInspectionMedia(item: InspectionMediaItem): Promise<void> {
  const { error } = await supabase.from('inspection_media').delete().eq('id', item.id);
  if (error) throw new Error(error.message);
  await supabase.storage.from('inspection-media').remove([item.storagePath]);
}
