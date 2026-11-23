import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, size, space, text } from '@/theme';

type ScreenProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
};

/** Shared page frame: safe area, header row and a white surface for content. */
export function Screen({ title, subtitle, children, action }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {action}
      </View>
      <View style={styles.body}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    minHeight: size.header,
    paddingHorizontal: space[4],
    paddingBottom: space[2],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  headerText: { flex: 1, gap: 2 },
  title: { ...text.h1 },
  subtitle: { ...text.caption },
  body: { flex: 1, backgroundColor: colors.bg },
});
