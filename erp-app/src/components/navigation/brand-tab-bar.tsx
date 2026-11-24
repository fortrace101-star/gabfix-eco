import type { BottomTabBarProps } from 'expo-router/js-tabs';
import {
  Banknote,
  Bell,
  Briefcase,
  CalendarDays,
  House,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, shadow, size, space } from '@/theme';

/** Routes that stay reachable (the bell on Home) but never take a slot in the bar. */
const HIDDEN_TABS = new Set(['notifications']);

const tabIcons: Record<string, LucideIcon> = {
  home: House,
  jobs: Briefcase,
  schedule: CalendarDays,
  cash: Banknote,
  notifications: Bell,
  profile: UserRound,
};

/**
 * Port of the client-app brand tab bar (client-app/src/components/navigation/brand-tab-bar.tsx):
 * same surface, hairline border, yellow active icon pill and label weights, so both apps sit at the
 * same height and rhythm. The native tab bar cannot express the active pill.
 */
export function BrandTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  insets,
}: BottomTabBarProps) {
  return (
    <View role="tablist" style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space[2]) }]}>
      {state.routes.map((route, index) => {
        if (HIDDEN_TABS.has(route.name)) return null;
        const focused = state.index === index;
        const options = descriptors[route.key].options;
        const label = typeof options.title === 'string' ? options.title : route.name;
        const Icon = tabIcons[route.name] ?? Briefcase;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            accessibilityState={focused ? { selected: true } : {}}
            onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
            onPress={() => {
              const event = emitter.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (focused || event.defaultPrevented) return;
              navigateToTab(route.key);
            }}
            style={styles.item}>
            <View style={[styles.iconPill, focused && styles.iconPillOn]}>
              <Icon
                size={22}
                strokeWidth={2}
                color={focused ? colors.green900 : colors.textMuted}
              />
            </View>
            <Text
              maxFontSizeMultiplier={1.3}
              numberOfLines={1}
              style={[styles.label, focused && styles.labelOn]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: space[2],
    minHeight: size.tabBar,
    ...shadow.floating,
  },
  item: {
    flex: 1,
    minHeight: size.touch,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconPill: {
    width: 48,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillOn: { backgroundColor: colors.yellow500 },
  label: {
    fontFamily: font.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
    color: colors.textMuted,
  },
  labelOn: { color: colors.green900, fontFamily: font.bodySemi },
});
