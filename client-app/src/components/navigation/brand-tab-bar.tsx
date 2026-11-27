import type { BottomTabBarProps } from 'expo-router/js-tabs';
import {
  CalendarDays,
  House,
  MessageCircle,
  Sparkles,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useBookingUpdateCount } from '@/store/bookings';
import { useThreads } from '@/store/messages';
import { colors, font, radius, shadow, size, space } from '@/theme';
import { selectionHaptic } from '@/utils/haptics';

const tabIcons: Record<string, LucideIcon> = {
  home: House,
  services: Sparkles,
  bookings: CalendarDays,
  messages: MessageCircle,
  profile: UserRound,
};

const tabLabels: Record<string, string> = {
  home: 'Home',
  services: 'Services',
  bookings: 'Bookings',
  messages: 'Messages',
  profile: 'Profile',
};

/**
 * Brand tab bar (Gabfix_UI_Progress.md, Decision 16). The native tab bar cannot express the
 * yellow active pill, so the JS tabs navigator renders this instead.
 */
export function BrandTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  insets,
}: BottomTabBarProps) {
  const threads = useThreads();
  const bookingUpdates = useBookingUpdateCount();
  const badges: Record<string, number> = {
    bookings: bookingUpdates,
    messages: threads.reduce((total, thread) => total + thread.unread, 0),
  };

  return (
    <View role="tablist" style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space[2]) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const options = descriptors[route.key].options;
        const label =
          tabLabels[route.name] ??
          (typeof options.title === 'string' ? options.title : route.name);
        const Icon = tabIcons[route.name] ?? Sparkles;
        const badge = badges[route.name] ?? 0;
        const badgeLabel = badge > 0 ? `, ${badge} ${badge === 1 ? 'update' : 'updates'}` : '';

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={`${options.tabBarAccessibilityLabel ?? label}${badgeLabel}`}
            accessibilityState={focused ? { selected: true } : {}}
            onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
            onPress={() => {
              const event = emitter.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (focused || event.defaultPrevented) return;
              selectionHaptic();
              navigateToTab(route.key);
            }}
            style={styles.item}>
            <View style={[styles.iconPill, focused && styles.iconPillOn]}>
              <Icon
                size={22}
                strokeWidth={2}
                color={focused ? colors.green900 : colors.textMuted}
              />
              {badge > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText} maxFontSizeMultiplier={1.1}>
                    {badge > 9 ? '9+' : badge}
                  </Text>
                </View>
              ) : null}
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
  // Sits slightly left and lower so every badge overlaps its icon a little.
  badge: {
    position: 'absolute',
    top: 1,
    right: 8,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: font.bodySemi,
    fontSize: 10,
    lineHeight: 13,
    color: colors.surface,
  },
  label: {
    fontFamily: font.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
    color: colors.textMuted,
  },
  labelOn: { color: colors.green900, fontFamily: font.bodySemi },
});
