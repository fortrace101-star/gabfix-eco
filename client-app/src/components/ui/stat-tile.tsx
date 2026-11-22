import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, space, text } from '@/theme';

type StatTileProps = {
  label: string;
  value: string | number;
  /** Makes the tile a button, e.g. opening the matching list. */
  onPress?: () => void;
  /** Spoken after the value when the tile is tappable. */
  accessibilityHint?: string;
};

/** Small green stat block used by Security, Devices and future dashboards. */
export function StatTile({ label, value, onPress, accessibilityHint }: StatTileProps) {
  const content = (
    <>
      <Text style={styles.label} maxFontSizeMultiplier={1.2}>
        {label}
      </Text>
      <Text style={styles.value} maxFontSizeMultiplier={1.2}>
        {value}
      </Text>
    </>
  );

  if (!onPress) {
    return (
      <View style={styles.tile} accessible accessibilityLabel={`${label}: ${value}`}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 72,
    borderRadius: radius.input,
    backgroundColor: colors.green50,
    padding: space[3],
    gap: 2,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.65 },
  label: {
    ...text.caption,
    fontFamily: font.bodySemi,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.green700,
  },
  value: {
    fontFamily: font.poppinsSemi,
    fontSize: 24,
    lineHeight: 32,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
});
