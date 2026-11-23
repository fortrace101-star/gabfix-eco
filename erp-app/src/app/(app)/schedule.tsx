import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { useAuth } from '@/store/auth';
import { supabase } from '@/lib/supabase';
import { colors, radius, space, text } from '@/theme';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type Availability = {
  weekday: number;
  start_time: string;
  end_time: string;
};

type SkillCap = { skills: { name: string; max_daily_hours: number } | null };

async function fetchSchedule(profileId: string) {
  const [availability, overrides, skills] = await Promise.all([
    supabase
      .from('technician_availability')
      .select('weekday, start_time, end_time')
      .eq('technician_id', profileId)
      .order('weekday'),
    supabase
      .from('technician_overrides')
      .select('date, start_time, end_time, is_off')
      .eq('technician_id', profileId)
      .gte('date', new Date().toISOString().slice(0, 10))
      .order('date'),
    supabase
      .from('technician_skills')
      .select('skills(name, max_daily_hours)')
      .eq('technician_id', profileId),
  ]);

  const firstError = availability.error ?? overrides.error ?? skills.error;
  if (firstError) throw new Error(firstError.message);

  return {
    availability: (availability.data ?? []) as Availability[],
    overrides: overrides.data ?? [],
    caps: ((skills.data ?? []) as unknown as SkillCap[])
      .map((row) => row.skills)
      .filter((skill): skill is { name: string; max_daily_hours: number } => !!skill),
  };
}

export default function ScheduleScreen() {
  const { profile } = useAuth();
  const { data, error, isLoading } = useQuery({
    queryKey: ['schedule', profile?.id],
    queryFn: () => fetchSchedule(profile!.id),
    enabled: !!profile,
  });

  const cap = data?.caps.length ? Math.min(...data.caps.map((s) => s.max_daily_hours)) : null;

  return (
    <Screen title="Schedule" subtitle="Your working pattern">
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.green500} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.caption}>Could not load your schedule.</Text>
          <Text style={styles.caption}>{error.message}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Weekly pattern</Text>
            {data?.availability.length ? (
              data.availability.map((row) => (
                <View key={row.weekday} style={styles.row}>
                  <Text style={styles.body}>{WEEKDAYS[row.weekday]}</Text>
                  <Text style={styles.time}>
                    {row.start_time.slice(0, 5)} – {row.end_time.slice(0, 5)}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.caption}>No availability set. Ask dispatch to add it.</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Daily hours cap</Text>
            <Text style={styles.big}>{cap != null ? `${cap} h` : '—'}</Text>
            <Text style={styles.caption}>
              {data?.caps.length
                ? data.caps.map((skill) => `${skill.name}: ${skill.max_daily_hours} h`).join(' · ')
                : 'No trade assigned yet.'}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Upcoming overrides</Text>
            {data?.overrides.length ? (
              data.overrides.map((row) => (
                <View key={row.date} style={styles.row}>
                  <Text style={styles.body}>{row.date}</Text>
                  <Text style={styles.time}>
                    {row.is_off
                      ? 'Day off'
                      : `${row.start_time?.slice(0, 5) ?? '—'} – ${row.end_time?.slice(0, 5) ?? '—'}`}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.caption}>None in the next weeks.</Text>
            )}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[6], gap: space[2] },
  content: { padding: space[4], gap: space[3], paddingBottom: space[8] },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[2],
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: { ...text.caption, textTransform: 'uppercase', color: colors.textMuted },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space[2] },
  body: { ...text.body },
  time: { ...text.bodyM, color: colors.green700 },
  caption: { ...text.caption },
  big: { ...text.h1 },
});
