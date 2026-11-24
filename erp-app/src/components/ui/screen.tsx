import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, space, text } from '@/theme';

type ScreenProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
};

/**
 * Page frame matching app-1's tab screens: the title sits in the content at
 * `insets.top + 16` with a 16px gutter, Poppins 700 at 26/34, and the subtitle
 * directly under it at 14/20 muted.
 */
export function Screen({ title, subtitle, children, action }: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.safe}>
      <View style={[styles.header, { paddingTop: insets.top + space[4] }]}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {action}
        </View>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: space[4],
    paddingBottom: space[2],
    gap: space[1],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  title: { ...text.h1, flex: 1 },
  subtitle: { ...text.body, color: colors.textMuted },
  body: { flex: 1, backgroundColor: colors.bg },
});
