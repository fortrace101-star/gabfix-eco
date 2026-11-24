import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KeyboardScreen } from '@/components/ui/keyboard-screen';
import { TopBar } from '@/components/ui/top-bar';
import { updateSessionUser, useAuthUser } from '@/store/session';
import { colors, radius, space, text } from '@/theme';
import { phoneUG } from '@/utils/format';
import { isValidUGPhone, normaliseUGPhone } from '@/utils/validation';

/** P27e personal details. Local profile editing until `PUT /me` is connected. */
export default function EditProfileScreen() {
  const user = useAuthUser();
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(normaliseUGPhone(user?.phone ?? ''));
  const [email, setEmail] = useState(user?.email ?? '');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const nameValid = name.trim().length >= 2;
  const phoneValid = phone.length === 0 || isValidUGPhone(phone);
  const emailValid = email.trim().length === 0 || /^\S+@\S+\.\S+$/.test(email.trim());
  const valid = nameValid && phoneValid && emailValid;

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    setSaving(true);
    await updateSessionUser({
      name: name.trim(),
      phone: phone ? normaliseUGPhone(phone) : undefined,
      email: email.trim() || undefined,
    });
    setSaving(false);
    router.back();
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <TopBar title="Personal details" />
      <KeyboardScreen style={styles.flex} contentContainerStyle={styles.content}>
        <Text style={styles.intro} maxFontSizeMultiplier={1.3}>
          Keep your contact details up to date so your cleaner and support can reach you.
        </Text>

        <Input
          label="Full name"
          value={name}
          onChangeText={setName}
          onBlur={() => setTouched(true)}
          placeholder="Aisha Nakato"
          autoCapitalize="words"
          textContentType="name"
          error={touched && !nameValid ? 'Enter your full name.' : undefined}
        />
        <Input
          label="Phone number"
          value={phoneUG(phone)}
          onChangeText={(value) => setPhone(normaliseUGPhone(value).slice(0, 10))}
          onBlur={() => setTouched(true)}
          placeholder="0772 123 456"
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          error={touched && !phoneValid ? 'Enter your 10-digit number, for example 0772 123 456.' : undefined}
        />
        <Input
          label="Email (optional)"
          value={email}
          onChangeText={setEmail}
          onBlur={() => setTouched(true)}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          error={touched && !emailValid ? 'Enter a valid email address.' : undefined}
        />

        <View style={styles.note}>
          <Text style={styles.noteText} maxFontSizeMultiplier={1.3}>
            These changes are saved on this device. Your account and phone verification stay
            unchanged until the profile API is connected.
          </Text>
        </View>

        <Button label="Save details" onPress={save} loading={saving} />
      </KeyboardScreen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: space[4], paddingBottom: space[8], gap: space[4] },
  intro: { ...text.bodyM, color: colors.textMuted },
  note: {
    backgroundColor: colors.green50,
    borderRadius: radius.input,
    padding: space[3],
  },
  noteText: { ...text.caption, color: colors.green900, lineHeight: 18 },
});
