import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/brand/brand-logo';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/store/auth';
import { colors, radius, shadow, space, text } from '@/theme';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    if (!email.trim() || !password) {
      setError('Enter your work email and password.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <BrandLogo size={56} />
            <Text style={styles.brandTitle}>Gabfix Portal</Text>
            <Text style={styles.brandSubtitle}>Staff operations · Uganda</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign in</Text>
            <Text style={styles.cardHint}>Use the work account your manager invited.</Text>

            <TextField
              label="Work email"
              value={email}
              onChangeText={setEmail}
              placeholder="name@gabfix.ug"
              keyboardType="email-address"
              autoComplete="email"
              editable={!submitting}
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoComplete="password"
              editable={!submitting}
            />

            {error ? (
              <View style={styles.errorBox} accessibilityRole="alert">
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Button label="Sign in" onPress={onSubmit} loading={submitting} />

            {__DEV__ ? (
              <Text style={styles.devHint}>
                Local seed: tech1@gabfix.ug · manager@gabfix.ug · admin@gabfix.ug — password
                gabfix2026
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.green700 },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: space[5], gap: space[6] },
  brand: { alignItems: 'center', gap: space[2] },
  brandTitle: { ...text.h1, color: colors.surface },
  brandSubtitle: { ...text.caption, color: colors.whiteTextMuted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: space[5],
    gap: space[4],
    ...shadow.card,
  },
  cardTitle: { ...text.h2 },
  cardHint: { ...text.caption, marginTop: -space[3] },
  errorBox: { backgroundColor: colors.errorBg, borderRadius: radius.input, padding: space[3] },
  errorText: { ...text.caption, color: colors.error },
  devHint: { ...text.caption, textAlign: 'center', color: colors.textMuted },
});
