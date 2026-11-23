import Constants from 'expo-constants';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { useAuth } from '@/store/auth';
import { colors, radius, space, text } from '@/theme';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  customer_relations: 'Customer relations',
  sales_operator: 'Sales operator',
  technician: 'Technician',
  laundry_operator: 'Laundry operator',
  customer: 'Customer',
};

export default function ProfileScreen() {
  const { profile, session, role, signOut } = useAuth();

  return (
    <Screen title="Profile" subtitle="Account and app details">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile?.full_name?.slice(0, 1).toUpperCase() ?? '?'}</Text>
          </View>
          <Text style={styles.name}>{profile?.full_name ?? 'Staff member'}</Text>
          <Text style={styles.role}>{role ? ROLE_LABELS[role] ?? role : 'Role loading'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contact</Text>
          <Text style={styles.body}>{session?.user.email ?? '—'}</Text>
          <Text style={styles.caption}>{profile?.phone ?? 'No phone on the profile'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>App</Text>
          <View style={styles.row}>
            <Text style={styles.body}>Version</Text>
            <Text style={styles.caption}>{Constants.expoConfig?.version ?? '1.0.0'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.body}>Build</Text>
            <Text style={styles.caption}>{Constants.expoConfig?.name ?? 'Gabfix Portal'}</Text>
          </View>
        </View>

        <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space[4], gap: space[3], paddingBottom: space[8] },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[2],
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.green50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...text.h2, color: colors.green700 },
  name: { ...text.h2 },
  role: { ...text.caption },
  sectionTitle: { ...text.caption, textTransform: 'uppercase', color: colors.textMuted },
  body: { ...text.body },
  caption: { ...text.caption },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch' },
});
