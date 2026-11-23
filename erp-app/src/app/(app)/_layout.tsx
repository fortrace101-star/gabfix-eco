import { Tabs } from 'expo-router/js-tabs';
import { Banknote, Bell, Briefcase, CalendarDays, UserRound } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/store/auth';
import { colors, font, size } from '@/theme';
import { StyleSheet, Text, View } from 'react-native';

type TabRole = 'jobs' | 'schedule' | 'cash' | 'notifications' | 'profile';

const VISIBLE_FOR: Record<TabRole, string[]> = {
  jobs: ['technician', 'customer_relations', 'manager', 'admin'],
  schedule: ['technician', 'manager', 'admin'],
  cash: ['technician', 'manager', 'admin'],
  notifications: ['technician', 'laundry_operator', 'sales_operator', 'customer_relations', 'manager', 'admin'],
  profile: ['technician', 'laundry_operator', 'sales_operator', 'customer_relations', 'manager', 'admin'],
};

export default function AppLayout() {
  const { role, profile, signOut } = useAuth();

  if (profile?.status === 'deactivated') {
    return (
      <View style={styles.deactivated}>
        <Text style={styles.deactivatedTitle}>Account deactivated</Text>
        <Text style={styles.deactivatedBody}>
          Your access to the Gabfix portal has been turned off. Contact your manager if this is a
          mistake.
        </Text>
        <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
      </View>
    );
  }

  const visible = (tab: TabRole) => (role ? VISIBLE_FOR[tab].includes(role) : false);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.green500,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { height: size.tabBar, paddingTop: 6, backgroundColor: colors.surface },
        tabBarLabelStyle: { fontFamily: font.bodyMedium, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.bg },
      }}>
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          href: visible('jobs') ? undefined : null,
          tabBarIcon: ({ color, size: iconSize }) => (
            <Briefcase color={color} size={iconSize} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Schedule',
          href: visible('schedule') ? undefined : null,
          tabBarIcon: ({ color, size: iconSize }) => (
            <CalendarDays color={color} size={iconSize} />
          ),
        }}
      />
      <Tabs.Screen
        name="cash"
        options={{
          title: 'Cash',
          href: visible('cash') ? undefined : null,
          tabBarIcon: ({ color, size: iconSize }) => <Banknote color={color} size={iconSize} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          href: visible('notifications') ? undefined : null,
          tabBarIcon: ({ color, size: iconSize }) => <Bell color={color} size={iconSize} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          href: visible('profile') ? undefined : null,
          tabBarIcon: ({ color, size: iconSize }) => (
            <UserRound color={color} size={iconSize} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  deactivated: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: colors.bg,
  },
  deactivatedTitle: { fontFamily: font.heading, fontSize: 24, color: colors.text },
  deactivatedBody: { fontFamily: font.body, fontSize: 15, lineHeight: 22, color: colors.textMuted },
});
