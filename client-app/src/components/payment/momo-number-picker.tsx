import { Check, Smartphone } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import type { SavedMobileMoney } from '@/config/payments';
import { formatMomo, normalizeMomoInput, type MomoNetwork } from '@/lib/momo';
import { colors, font, radius, space, text } from '@/theme';

type Props = {
  network: MomoNetwork;
  saved: SavedMobileMoney[];
  selected: string | 'new';
  onSelect: (id: string | 'new') => void;
  value: string;
  onChange: (value: string) => void;
  save: boolean;
  onSaveChange: (save: boolean) => void;
  error?: string;
  onBlur?: () => void;
};

const providerLabel = (network: MomoNetwork): string =>
  network === 'mtn_momo' ? 'MTN' : 'Airtel';

/** 11.2: saved numbers per network, or "Use new number" with validation. */
export function MomoNumberPicker({
  network,
  saved,
  selected,
  onSelect,
  value,
  onChange,
  save,
  onSaveChange,
  error,
  onBlur,
}: Props) {
  const showNew = selected === 'new' || saved.length === 0;

  return (
    <View style={styles.wrap}>
      <View accessibilityRole="radiogroup" style={styles.list}>
        {saved.map((item) => {
          const isSelected = selected === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="radio"
              accessibilityLabel={`${providerLabel(network)} saved number +256 ${formatMomo(item.phone)}`}
              accessibilityState={{ selected: isSelected }}
              aria-checked={isSelected}
              onPress={() => onSelect(item.id)}
              style={[styles.row, isSelected && styles.rowSelected]}
            >
              <View style={styles.iconTile}>
                <Smartphone size={20} color={colors.green700} strokeWidth={2} />
              </View>
              <View style={styles.body}>
                <Text style={styles.number} maxFontSizeMultiplier={1.3}>
                  +256 {formatMomo(item.phone)}
                </Text>
                <Text style={styles.savedTag} maxFontSizeMultiplier={1.2}>
                  Saved
                </Text>
              </View>
              {isSelected ? <Check size={18} color={colors.green700} strokeWidth={2.5} /> : null}
            </Pressable>
          );
        })}

        <Pressable
          accessibilityRole="radio"
          accessibilityLabel="Use new number"
          accessibilityState={{ selected: selected === 'new' || saved.length === 0 }}
          aria-checked={selected === 'new' || saved.length === 0}
          onPress={() => onSelect('new')}
          style={[
            styles.row,
            (selected === 'new' || saved.length === 0) && styles.rowSelected,
          ]}
        >
          <View style={styles.body}>
            <Text style={styles.newLabel} maxFontSizeMultiplier={1.3}>
              + Use new number
            </Text>
          </View>
          {selected === 'new' || saved.length === 0 ? (
            <Check size={18} color={colors.green700} strokeWidth={2.5} />
          ) : null}
        </Pressable>
      </View>

      {showNew ? (
        <View style={styles.newFields}>
          <Input
            label="Mobile money number"
            placeholder="0771 234 567"
            value={value}
            onChangeText={(next) => onChange(normalizeMomoInput(next))}
            onBlur={onBlur}
            keyboardType="phone-pad"
            maxLength={12}
            helper="You'll get a prompt on this number."
            error={error}
            returnKeyType="done"
          />
          <Checkbox
            checked={save}
            onChange={onSaveChange}
            label="Save this number for next time"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[3] },
  list: { gap: space[2] },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowSelected: { borderColor: colors.green500, backgroundColor: colors.green50 },
  iconTile: {
    width: 32,
    height: 32,
    borderRadius: radius.tile,
    backgroundColor: colors.green50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 1 },
  number: { ...text.bodyM, fontFamily: font.bodySemi },
  savedTag: { ...text.caption, color: colors.textMuted },
  newLabel: { ...text.bodyM, fontFamily: font.bodySemi, color: colors.green700 },
  newFields: { gap: space[3] },
});
