import { useState, type ReactNode } from 'react';
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
  /** Rendered inside the input on the right, e.g. a show-password toggle. */
  trailing?: ReactNode;
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
  trailing,
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
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
            trailing ? styles.inputWithTrailing : null,
            focused && styles.focused,
            !!error && styles.invalid,
            !editable && styles.disabled,
          ]}
        />
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[2] },
  label: { ...text.caption, color: colors.textMuted },
  inputWrap: { justifyContent: 'center' },
  inputWithTrailing: { paddingRight: space[10] },
  trailing: { position: 'absolute', right: space[2], height: size.input, justifyContent: 'center' },
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
