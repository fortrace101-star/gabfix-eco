import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Camera, Images, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  addInspectionPhoto,
  listInspectionPhotos,
  removeInspectionPhoto,
  type InspectionPhoto,
} from '@/lib/inspection-photos';
import { pickPhoto } from '@/lib/photos';
import { useAuth } from '@/store/auth';
import { colors, radius, shadow, space, text } from '@/theme';

/** Evidence for the desk: what the space looked like when the inspector visited. */
export function InspectionPhotos({
  inspectionId,
  readOnly,
}: {
  inspectionId: string;
  readOnly: boolean;
}) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['inspection-photos', inspectionId];
  const [busy, setBusy] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => listInspectionPhotos(inspectionId),
  });

  const add = useMutation({
    mutationFn: async (source: 'camera' | 'library') => {
      const uri = await pickPhoto(source);
      if (!uri) return;
      await addInspectionPhoto({ inspectionId, uri, uploaderId: profile?.id ?? null });
    },
    onMutate: () => setBusy(true),
    onSettled: async () => {
      setBusy(false);
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (mutationError) => Alert.alert('Photo not attached', mutationError.message),
  });

  const remove = useMutation({
    mutationFn: (photo: InspectionPhoto) => removeInspectionPhoto(photo),
    onMutate: () => setBusy(true),
    onSettled: async () => {
      setBusy(false);
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (mutationError) => Alert.alert('Could not remove the photo', mutationError.message),
  });

  const confirmRemove = (photo: InspectionPhoto) => {
    Alert.alert('Remove this photo?', 'The desk will no longer see it on the report.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(photo) },
    ]);
  };

  const photos = data ?? [];

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.sectionTitle}>Photos</Text>
        <Text style={styles.caption}>
          {photos.length} photo{photos.length === 1 ? '' : 's'}
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.green500} />
      ) : error ? (
        <Text style={styles.caption}>{error.message}</Text>
      ) : photos.length ? (
        <View style={styles.thumbs}>
          {photos.map((photo) => (
            <View key={photo.id} style={styles.thumbWrap}>
              <View style={styles.thumb}>
                {photo.url ? (
                  <Image
                    source={{ uri: photo.url }}
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
                  accessibilityLabel="Remove photo"
                  hitSlop={6}
                  onPress={() => confirmRemove(photo)}
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
            ? 'No photos were attached to this report.'
            : 'Add a photo of the space so the desk can see what you are pricing.'}
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
