import { router, type Href } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { InlineBanner } from '@/components/ui/inline-banner';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { TopBar } from '@/components/ui/top-bar';
import { deleteLocalAccount } from '@/lib/account';
import { ApiError } from '@/lib/api/client';
import { deleteAccount, fetchDeletionStatus, type DeletionStatus } from '@/lib/api/account';
import { colors, radius, space, text } from '@/theme';

const KEPT = [
  'Bookings, payments and receipts stay for accounting, shown as “Deleted customer”.',
  'Cash, commission, job costs and referral rewards already owed are still paid.',
  'A non-identifying deletion record is kept, so the same number cannot claim a welcome or referral offer again.',
];

const REMOVED = [
  'Your name, phone number, email, photo and saved addresses.',
  'Saved mobile-money numbers and push notification tokens.',
  'Your messages in support tickets and job chats, and your review comments.',
];

/** C2 delete-account screen (D14): blockers, password confirmation, irreversible warning. */
export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<DeletionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // The blockers can change while the screen is open, so the check re-runs on retry.
  useEffect(() => {
    let cancelled = false;
    fetchDeletionStatus()
      .then((next) => {
        if (cancelled) return;
        setStatus(next);
        setLoadError(null);
        setLoading(false);
      })
      .catch((loadFailure: unknown) => {
        if (cancelled) return;
        setLoadError(
          loadFailure instanceof Error
            ? loadFailure.message
            : 'Could not check whether your account can be deleted.',
        );
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    setLoading(true);
    setLoadError(null);
    setAttempt((value) => value + 1);
  };

  const blockers = status
    ? [
        status.upcomingBookings > 0
          ? `${status.upcomingBookings} upcoming booking${status.upcomingBookings === 1 ? '' : 's'} still on the calendar.`
          : null,
        status.outstandingBalance > 0
          ? `UGX ${Math.round(status.outstandingBalance).toLocaleString('en-UG')} still owed on your bookings.`
          : null,
        status.openDisputes > 0
          ? `${status.openDisputes} cash dispute${status.openDisputes === 1 ? '' : 's'} still open.`
          : null,
      ].filter((item): item is string => Boolean(item))
    : [];

  const canDelete = Boolean(status?.canDelete) && !loading;

  const askToConfirm = () => {
    setError(null);
    if (!password.trim()) {
      setPasswordError('Enter your password to continue.');
      return;
    }
    setPasswordError(null);
    setConfirmOpen(true);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(password);
      // The server has already closed every session; clear this device too.
      await deleteLocalAccount();
      setConfirmOpen(false);
      router.replace('/login' as Href);
    } catch (failure) {
      setConfirmOpen(false);
      const message =
        failure instanceof ApiError && failure.code === 'password_mismatch'
          ? 'That password does not match this account.'
          : failure instanceof Error
            ? failure.message
            : 'Could not delete the account. Try again.';
      if (failure instanceof ApiError && failure.code === 'password_mismatch') {
        setPasswordError(message);
      } else {
        setError(message);
      }
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <TopBar title="Delete account" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[10] }]}
        showsVerticalScrollIndicator={false}>
        <InlineBanner
          variant="error"
          title="This cannot be undone"
          message="Permanent deletion is different from signing out or a temporary deactivation. Your account cannot be reactivated afterwards."
        />

        {loading ? (
          <View style={styles.card}>
            <Skeleton style={{ width: '70%', height: 16 }} />
            <Skeleton style={{ width: '90%', height: 12 }} />
            <Skeleton style={{ width: '60%', height: 12 }} />
          </View>
        ) : loadError ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>We could not check your account</Text>
            <Text style={styles.body}>{loadError}</Text>
            <Button label="Try again" variant="secondary" onPress={retry} />
          </View>
        ) : (
          <>
            {canDelete ? (
              <InlineBanner
                variant="success"
                message="Nothing is blocking deletion. Enter your password to continue."
              />
            ) : (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Before you can delete your account</Text>
                {blockers.map((blocker) => (
                  <View key={blocker} style={styles.bulletRow}>
                    <View style={styles.bullet} />
                    <Text style={styles.body}>{blocker}</Text>
                  </View>
                ))}
                <Text style={styles.hint}>
                  Settle these first, then come back. Upcoming bookings can be cancelled from the
                  booking itself.
                </Text>
                <Button
                  label="Open my bookings"
                  variant="secondary"
                  onPress={() => router.push('/(tabs)/bookings' as Href)}
                />
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>What we remove</Text>
              {REMOVED.map((item) => (
                <View key={item} style={styles.bulletRow}>
                  <View style={styles.bullet} />
                  <Text style={styles.body}>{item}</Text>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>What we keep</Text>
              {KEPT.map((item) => (
                <View key={item} style={styles.bulletRow}>
                  <View style={styles.bullet} />
                  <Text style={styles.body}>{item}</Text>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Confirm with your password</Text>
              <Input
                label="Password"
                secure
                placeholder="Your Gabfix password"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  if (passwordError) setPasswordError(null);
                }}
                error={passwordError ?? undefined}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                editable={!busy && canDelete}
              />
              {error ? <InlineBanner variant="error" message={error} /> : null}
              <Button
                label="Delete my account permanently"
                variant="destructive"
                icon={Trash2}
                disabled={!canDelete || busy}
                onPress={askToConfirm}
              />
              <Text style={styles.hint}>
                Signing out instead keeps your bookings, wallet and chat history.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      <ConfirmSheet
        visible={confirmOpen}
        title="Delete account permanently?"
        body="Your personal details and messages will be removed, and you will be signed out on every device. This cannot be undone."
        confirmLabel="Delete permanently"
        busy={busy}
        icon={Trash2}
        onClose={() => (busy ? undefined : setConfirmOpen(false))}
        onConfirm={() => void submit()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space[4], gap: space[4] },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: space[4],
    gap: space[3],
  },
  cardTitle: { ...text.h3 },
  body: { ...text.body, color: colors.textMuted, flex: 1 },
  hint: { ...text.caption, color: colors.textMuted },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
    backgroundColor: colors.green500,
  },
});
