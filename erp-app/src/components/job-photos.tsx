import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Camera, Images, RotateCcw } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  flushPhotoQueue,
  pendingPhotosFor,
  pickPhoto,
  savePhoto,
  type PhotoKind,
} from '@/lib/photos';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import { colors, radius, shadow, space, text } from '@/theme';

type PhotoRow = {
  id: string;
  storage_path: string;
  kind: PhotoKind;
};

async function fetchPhotos(bookingId: string) {
  const { data, error } = await supabase
    .from('job_photos')
    .select('id, storage_path, kind')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as PhotoRow[];
  if (!rows.length) return [] as { row: PhotoRow; url: string | null }[];

  const { data: signed } = await supabase.storage
    .from('job-photos')
    .createSignedUrls(
      rows.map((row) => row.storage_path),
      60 * 60,
    );

  const urls = new Map((signed ?? []).map((entry) => [entry.path, entry.signedUrl]));
  return rows.map((row) => ({ row, url: urls.get(row.storage_path) ?? null }));
}

const KINDS: { key: PhotoKind; label: string }[] = [
  { key: 'before', label: 'Before' },
  { key: 'after', label: 'After' },
];

/** Before/after photos for one job, with an offline queue that retries on focus. */
export function JobPhotos({ bookingId }: { bookingId: string }) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['job-photos', bookingId], [bookingId]);
  const [retrying, setRetrying] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => ({
      photos: await fetchPhotos(bookingId),
      pending: await pendingPhotosFor(bookingId),
    }),
  });

  const pending = data?.pending ?? 0;

  const retry = useCallback(async () => {
    setRetrying(true);
    try {
      const result = await flushPhotoQueue(profile?.id ?? null);
      if (result.uploaded) await queryClient.invalidateQueries({ queryKey });
      if (result.uploaded && result.remaining === 0) {
        Alert.alert('Photos uploaded', `${result.uploaded} queued photo(s) are now on the job.`);
      }
    } finally {
      setRetrying(false);
    }
  }, [profile?.id, queryClient, queryKey]);

  const add = useMutation({
    mutationFn: async ({ kind, source }: { kind: PhotoKind; source: 'camera' | 'library' }) => {
      const uri = await pickPhoto(source);
      if (!uri) return null;
      return savePhoto({ bookingId, kind, uri, uploaderId: profile?.id ?? null });
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (mutationError) => {
      Alert.alert(
        'Photo not uploaded',
        `${mutationError.message}\n\nIt is saved on this device and will retry when you are back online.`,
      );
    },
  });

  const choose = (kind: PhotoKind) => {
    Alert.alert(`Add ${kind} photo`, 'Take a photo now or choose one from your library.', [
      { text: 'Camera', onPress: () => add.mutate({ kind, source: 'camera' }) },
      { text: 'Library', onPress: () => add.mutate({ kind, source: 'library' }) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.sectionTitle}>Photos</Text>
        {pending ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Retry ${pending} queued photos`}
            onPress={() => void retry()}
            disabled={retrying}
            style={styles.retry}>
            {retrying ? (
              <ActivityIndicator size="small" color={colors.yellow800} />
            ) : (
              <RotateCcw size={13} color={colors.yellow800} />
            )}
            <Text style={styles.retryText}>{pending} waiting</Text>
          </Pressable>
        ) : null}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.green500} />
      ) : (
        KINDS.map(({ key, label }) => {
          const photos = (data?.photos ?? []).filter((entry) => entry.row.kind === key);
          return (
            <View key={key} style={styles.group}>
              <View style={styles.groupHead}>
                <Text style={styles.groupLabel}>{label}</Text>
                <Text style={styles.caption}>{photos.length} photo(s)</Text>
              </View>

              {photos.length ? (
                <View style={styles.thumbs}>
                  {photos.map((entry) => (
                    <View key={entry.row.id} style={styles.thumb}>
                      {entry.url ? (
                        <Image
                          source={{ uri: entry.url }}
                          style={styles.thumbImage}
                          contentFit="cover"
                          accessibilityLabel={`${label} photo`}
                        />
                      ) : (
                        <View style={styles.thumbMissing}>
                          <Text style={styles.caption}>No preview</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.caption}>No {label.toLowerCase()} photos yet.</Text>
              )}

              <View style={styles.buttons}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Take ${label.toLowerCase()} photo`}
                  onPress={() => choose(key)}
                  disabled={add.isPending}
                  style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
                  <Camera size={15} color={colors.green700} />
                  <Text style={styles.pillText}>Camera</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Choose ${label.toLowerCase()} photo from library`}
                  onPress={() => add.mutate({ kind: key, source: 'library' })}
                  disabled={add.isPending}
                  style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
                  <Images size={15} color={colors.green700} />
                  <Text style={styles.pillText}>Library</Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[3],
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { ...text.caption, color: colors.textMuted, textTransform: 'uppercase' },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    backgroundColor: colors.warningBg,
    borderRadius: radius.pill,
    paddingHorizontal: space[2],
    paddingVertical: 4,
  },
  retryText: { ...text.caption, color: colors.yellow800 },
  group: { gap: space[2] },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  groupLabel: { ...text.bodyM },
  caption: { ...text.caption },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  thumb: { width: 76, height: 76, borderRadius: radius.tile, overflow: 'hidden', backgroundColor: colors.bg },
  thumbImage: { width: '100%', height: '100%' },
  thumbMissing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  buttons: { flexDirection: 'row', gap: space[2] },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.85 },
  pillText: { ...text.caption, color: colors.green700, fontFamily: 'Inter_600SemiBold' },
});
