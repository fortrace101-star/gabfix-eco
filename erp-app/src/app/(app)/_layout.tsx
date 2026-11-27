import { Tabs } from 'expo-router/js-tabs';

import { BrandTabBar } from '@/components/navigation/brand-tab-bar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/store/auth';
import { colors, font, size } from '@/theme';
import { StyleSheet, Text, View } from 'react-native';

// Expo Router reads this for the tab navigator's first screen. Home is where a
// technician starts the day.
export const unstable_settings = { anchor: 'home' };

type TabRole = 'home' | 'chat' | 'jobs' | 'schedule' | 'cash' | 'profile';

const HIDDEN_ROUTES = new Set(['index', 'notifications', 'inspections']);

const VISIBLE_FOR: Record<TabRole, string[]> = {
  home: ['technician', 'laundry_operator', 'sales_operator', 'customer_relations', 'manager', 'admin'],
  chat: ['technician', 'customer_relations', 'manager', 'admin'],
  jobs: ['technician', 'customer_relations', 'manager', 'admin'],
  schedule: ['technician', 'manager', 'admin'],
  cash: ['technician', 'manager', 'admin'],
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
      backBehavior="initialRoute"
      tabBar={(props) => <BrandTabBar {...props} hiddenRoutes={HIDDEN_ROUTES} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { minHeight: size.tabBar },
        sceneStyle: { backgroundColor: colors.bg },
      }}>
      <Tabs.Screen name="home" options={{ title: 'Home', href: visible('home') ? undefined : null }} />
      <Tabs.Screen
        name="chat"
        options={{ title: 'Chat', href: visible('chat') ? undefined : null }}
      />
      <Tabs.Screen name="jobs" options={{ title: 'Jobs', href: visible('jobs') ? undefined : null }} />
      <Tabs.Screen
        name="schedule"
        options={{ title: 'Schedule', href: visible('schedule') ? undefined : null }}
      />
      <Tabs.Screen name="cash" options={{ title: 'Cash', href: visible('cash') ? undefined : null }} />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', href: visible('profile') ? undefined : null }}
      />
      {/* Routes inside the tabs so the bar stays visible, filtered out of the bar itself. */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ title: 'Alerts' }} />
      <Tabs.Screen name="inspections" options={{ title: 'Inspections' }} />
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
