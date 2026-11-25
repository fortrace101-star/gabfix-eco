import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Camera, Film, Images, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  addInspectionMedia,
  listInspectionMedia,
  removeInspectionMedia,
  type InspectionMediaItem,
} from '@/lib/inspection-media';
import { pickPhoto, pickVideo } from '@/lib/photos';
import { useAuth } from '@/store/auth';
import { colors, radius, shadow, space, text } from '@/theme';

/** Evidence for the desk: what the space looked like when the inspector visited. */
export function InspectionEvidence({
  inspectionId,
  readOnly,
}: {
  inspectionId: string;
  readOnly: boolean;
}) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['inspection-media', inspectionId];
  const [busy, setBusy] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => listInspectionMedia(inspectionId),
  });

  const add = useMutation({
    mutationFn: async (source: 'camera' | 'library' | 'video') => {
      if (source === 'video') {
        const video = await pickVideo();
        if (!video) return;
        await addInspectionMedia({
          inspectionId,
          uri: video.uri,
          kind: 'video',
          mimeType: video.mimeType,
          uploaderId: profile?.id ?? null,
        });
        return;
      }

      const uri = await pickPhoto(source);
      if (!uri) return;
      await addInspectionMedia({
        inspectionId,
        uri,
        kind: 'photo',
        mimeType: 'image/jpeg',
        uploaderId: profile?.id ?? null,
      });
    },
    onMutate: () => setBusy(true),
    onSettled: async () => {
      setBusy(false);
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (mutationError) => Alert.alert('Evidence not attached', mutationError.message),
  });

  const remove = useMutation({
    mutationFn: (item: InspectionMediaItem) => removeInspectionMedia(item),
    onMutate: () => setBusy(true),
    onSettled: async () => {
      setBusy(false);
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (mutationError) => Alert.alert('Could not remove it', mutationError.message),
  });

  const confirmRemove = (item: InspectionMediaItem) => {
    Alert.alert(
      item.kind === 'video' ? 'Remove this video?' : 'Remove this photo?',
      'The desk will no longer see it on the report.',
      [
        { text: 'Keep', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(item) },
      ],
    );
  };

  const items = data ?? [];
  const photos = items.filter((item) => item.kind === 'photo').length;
  const videos = items.length - photos;
  const summary = [
    photos ? `${photos} photo${photos === 1 ? '' : 's'}` : null,
    videos ? `${videos} video${videos === 1 ? '' : 's'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.sectionTitle}>Photos & video</Text>
        <Text style={styles.caption}>{summary || 'Nothing yet'}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.green500} />
      ) : error ? (
        <Text style={styles.caption}>{error.message}</Text>
      ) : items.length ? (
        <View style={styles.thumbs}>
          {items.map((item) => (
            <View key={item.id} style={styles.thumbWrap}>
              <View style={styles.thumb}>
                {item.kind === 'video' ? (
                  <View style={styles.videoTile}>
                    <Film size={20} color={colors.green700} />
                    <Text style={styles.videoLabel}>Video</Text>
                  </View>
                ) : item.url ? (
                  <Image
                    source={{ uri: item.url }}
                    style={styles.thumbImage}
                    contentFit="cover"
                    accessibilityLabel="Inspection photo"
                  />
                ) : (
                  <View style={styles.thumbMissing}>
                    <Text style={styles.caption}>No preview</Text>
                  </View>
                )}
              </View>
              {readOnly ? null : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.kind === 'video' ? 'Remove video' : 'Remove photo'}
                  hitSlop={6}
                  onPress={() => confirmRemove(item)}
                  disabled={busy}
                  style={styles.remove}>
                  <Trash2 size={12} color={colors.error} />
                </Pressable>
              )}
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.caption}>
          {readOnly
            ? 'No photos or video were attached to this report.'
            : 'Add a photo or a short video of the space so the desk can see what you are pricing.'}
        </Text>
      )}

      {readOnly ? null : (
        <View style={styles.buttons}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Take an inspection photo"
            onPress={() => add.mutate('camera')}
            disabled={busy}
            style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
            <Camera size={15} color={colors.green700} />
            <Text style={styles.pillText}>Camera</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose an inspection photo from the library"
            onPress={() => add.mutate('library')}
            disabled={busy}
            style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
            {busy ? (
              <ActivityIndicator size="small" color={colors.green700} />
            ) : (
              <Images size={15} color={colors.green700} />
            )}
            <Text style={styles.pillText}>Library</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose an inspection video from the library"
            onPress={() => add.mutate('video')}
            disabled={busy}
            style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
            <Film size={15} color={colors.green700} />
            <Text style={styles.pillText}>Video</Text>
          </Pressable>
        </View>
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
  caption: { ...text.caption },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  thumbWrap: { width: 76, height: 76 },
  thumb: {
    width: 76,
    height: 76,
    borderRadius: radius.tile,
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
  thumbImage: { width: '100%', height: '100%' },
  thumbMissing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  videoTile: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  videoLabel: { ...text.caption, color: colors.green700, fontSize: 10 },
  remove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
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
