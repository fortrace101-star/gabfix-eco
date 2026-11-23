import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, font, radius, size, space, text } from '@/theme';

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'decimal-pad' | 'number-pad' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  autoComplete?: 'email' | 'password' | 'off';
  editable?: boolean;
  error?: string | null;
};

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoComplete = 'off',
  editable = true,
  error,
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={false}
        editable={editable}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          focused && styles.focused,
          !!error && styles.invalid,
          !editable && styles.disabled,
        ]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[2] },
  label: { ...text.caption, color: colors.textMuted },
  input: {
    minHeight: size.input,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: space[4],
    fontFamily: font.body,
    fontSize: 15,
    color: colors.text,
  },
  focused: { borderColor: colors.green500 },
  invalid: { borderColor: colors.error },
  disabled: { backgroundColor: colors.disabledBg, color: colors.disabledText },
  error: { ...text.caption, color: colors.error },
});
