import { Check, ChevronLeft, CreditCard, Smartphone } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MomoNumberPicker } from '@/components/payment/momo-number-picker';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { savedCardLabel } from '@/config/payments';
import { toStoredMomo, validateMomo, type MomoNetwork } from '@/lib/momo';
import type { PaymentMethod } from '@/lib/pricing';
import { useSavedCards, useSavedMobileMoney } from '@/store/payment-methods';
import { colors, radius, space, text } from '@/theme';
import { ugx } from '@/utils/format';

type PayMethod = Exclude<PaymentMethod, 'cash'>;

const methods: {
  id: PayMethod;
  label: string;
  hint: string;
  icon: typeof Smartphone;
}[] = [
  { id: 'mtn_momo', label: 'MTN Mobile Money', hint: 'Approve the prompt on your phone', icon: Smartphone },
  { id: 'airtel_money', label: 'Airtel Money', hint: 'Approve the prompt on your phone', icon: Smartphone },
  { id: 'visa_card', label: 'Visa card', hint: 'Secure hosted card page', icon: CreditCard },
];

export type BalancePaymentSelection = {
  method: PayMethod;
  phone?: string;
  savedMomoId?: string | 'new';
  last4?: string;
  cardId?: string;
  saveNumber?: boolean;
  saveCard?: boolean;
};

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  amount: number;
  onClose: () => void;
  onContinue: (selection: BalancePaymentSelection) => void;
};

const isMomo = (method: PayMethod): method is MomoNetwork =>
  method === 'mtn_momo' || method === 'airtel_money';

/** 11.3 Two-step balance payment drawer: method, then alternatives. Cash is never offered. */
export function PaymentMethodSheet({ visible, title, subtitle, amount, onClose, onContinue }: Props) {
  const savedCards = useSavedCards();
  const savedMobileMoney = useSavedMobileMoney();
  const [step, setStep] = useState<1 | 2>(1);
  const [method, setMethod] = useState<PayMethod>('mtn_momo');
  const [payerPhones, setPayerPhones] = useState<Partial<Record<MomoNetwork, string>>>({});
  const [savedMomoIds, setSavedMomoIds] = useState<Partial<Record<MomoNetwork, string | 'new'>>>({});
  const [saveNumber, setSaveNumber] = useState<Partial<Record<MomoNetwork, boolean>>>({});
  const [momoTouched, setMomoTouched] = useState<Partial<Record<MomoNetwork, boolean>>>({});
  const [cardChoice, setCardChoice] = useState<string>('new');
  const [saveCard, setSaveCard] = useState(false);

  const close = () => {
    setStep(1);
    setMethod('mtn_momo');
    setPayerPhones({});
    setSavedMomoIds({});
    setSaveNumber({});
    setMomoTouched({});
    setCardChoice('new');
    setSaveCard(false);
    onClose();
  };

  const savedMomoByNetwork = (network: MomoNetwork) =>
    savedMobileMoney.filter((item) =>
      network === 'mtn_momo' ? item.provider === 'MTN' : item.provider === 'Airtel',
    );

  const momoSelection = (network: MomoNetwork): string | 'new' => {
    const saved = savedMomoByNetwork(network);
    const selected = savedMomoIds[network];
    if (selected && selected !== 'new' && saved.some((item) => item.id === selected)) return selected;
    return saved.length > 0 ? (selected ?? saved[0].id) : 'new';
  };

  const momoReady = (network: MomoNetwork): boolean => {
    const selection = momoSelection(network);
    if (selection !== 'new') return savedMomoByNetwork(network).some((item) => item.id === selection);
    return validateMomo(network, payerPhones[network] ?? '') === null;
  };

  const momoError = (network: MomoNetwork): string | undefined => {
    if (momoSelection(network) !== 'new' || !momoTouched[network]) return undefined;
    return validateMomo(network, payerPhones[network] ?? '') ?? undefined;
  };

  const selectedCard = method === 'visa_card' ? savedCards.find((c) => c.id === cardChoice) : undefined;
  const ready = isMomo(method) ? momoReady(method) : true;

  const submit = () => {
    if (!ready) {
      if (isMomo(method)) setMomoTouched((c) => ({ ...c, [method]: true }));
      return;
    }
    if (isMomo(method)) {
      const network = method;
      const selection = momoSelection(network);
      const phone =
        selection !== 'new'
          ? (savedMomoByNetwork(network).find((item) => item.id === selection)?.phone ?? '')
          : toStoredMomo(payerPhones[network] ?? '');
      onContinue({
        method,
        phone,
        savedMomoId: selection,
        saveNumber: selection === 'new' ? Boolean(saveNumber[network]) : false,
      });
    } else {
      onContinue({
        method: 'visa_card',
        cardId: selectedCard?.id,
        last4: selectedCard?.last4,
        saveCard: !selectedCard ? saveCard : false,
      });
    }
    close();
  };

  return (
    <BottomSheet
      visible={visible}
      onDismiss={close}
      title={step === 1 ? title : method === 'visa_card' ? 'Choose card' : 'Choose number'}
      subtitle={step === 1 ? subtitle : `${ugx(amount)} due`}
      contentContainerStyle={styles.content}
      headerLeft={
        step === 2 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to payment methods"
            onPress={() => setStep(1)}
            hitSlop={8}
            style={styles.backBtn}>
            <ChevronLeft size={22} color={colors.text} strokeWidth={2} />
          </Pressable>
        ) : undefined
      }
      footer={
        step === 1 ? (
          <>
            <Button label="Continue" onPress={() => setStep(2)} />
            <Text style={styles.note} maxFontSizeMultiplier={1.2}>
              This local demo confirms the payment immediately. No money moves.
            </Text>
          </>
        ) : (
          <View style={styles.payFooter}>
            <Button label={`Pay ${ugx(amount)}`} onPress={submit} disabled={!ready} />
          </View>
        )
      }>
      {step === 1 ? (
        <>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel} maxFontSizeMultiplier={1.2}>Amount</Text>
            <Text style={styles.amount} maxFontSizeMultiplier={1.2}>{ugx(amount)}</Text>
          </View>
          <View accessibilityRole="radiogroup" style={styles.methods}>
            {methods.map((item) => {
              const Icon = item.icon;
              const selected = method === item.id;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="radio"
                  accessibilityLabel={`${item.label}. ${item.hint}`}
                  accessibilityState={{ selected }}
                  aria-checked={selected}
                  onPress={() => setMethod(item.id)}
                  style={[styles.method, selected && styles.methodSelected]}>
                  <View style={styles.methodIcon}>
                    <Icon size={22} color={colors.green700} strokeWidth={2} />
                  </View>
                  <View style={styles.methodCopy}>
                    <Text style={styles.methodLabel} maxFontSizeMultiplier={1.3}>{item.label}</Text>
                    <Text style={styles.methodHint} maxFontSizeMultiplier={1.2}>{item.hint}</Text>
                  </View>
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected ? <Check size={14} color={colors.surface} strokeWidth={3} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : isMomo(method) ? (
        <MomoNumberPicker
          network={method}
          saved={savedMomoByNetwork(method)}
          selected={momoSelection(method)}
          onSelect={(id) => setSavedMomoIds((c) => ({ ...c, [method]: id }))}
          value={payerPhones[method] ?? ''}
          onChange={(value) => setPayerPhones((c) => ({ ...c, [method]: value }))}
          save={Boolean(saveNumber[method])}
          onSaveChange={(save) => setSaveNumber((c) => ({ ...c, [method]: save }))}
          error={momoError(method)}
          onBlur={() => setMomoTouched((c) => ({ ...c, [method]: true }))}
        />
      ) : (
        <View style={styles.methods} accessibilityRole="radiogroup">
          {savedCards.map((card) => {
            const selected = cardChoice === card.id;
            return (
              <Pressable
                key={card.id}
                accessibilityRole="radio"
                accessibilityLabel={`${savedCardLabel(card)}, expires ${card.expiry}`}
                accessibilityState={{ selected }}
                aria-checked={selected}
                onPress={() => setCardChoice(card.id)}
                style={[styles.method, selected && styles.methodSelected]}>
                <View style={styles.methodIcon}>
                  <CreditCard size={20} color={colors.green700} strokeWidth={2} />
                </View>
                <View style={styles.methodCopy}>
                  <Text style={styles.methodLabel} maxFontSizeMultiplier={1.3}>{savedCardLabel(card)}</Text>
                  <Text style={styles.methodHint} maxFontSizeMultiplier={1.2}>Expires {card.expiry}</Text>
                </View>
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected ? <Check size={14} color={colors.surface} strokeWidth={3} /> : null}
                </View>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="radio"
            accessibilityLabel="Use a new card"
            accessibilityState={{ selected: cardChoice === 'new' || !selectedCard }}
            aria-checked={cardChoice === 'new' || !selectedCard}
            onPress={() => setCardChoice('new')}
            style={[styles.method, (cardChoice === 'new' || !selectedCard) && styles.methodSelected]}>
            <View style={styles.methodIcon}>
              <CreditCard size={20} color={colors.green700} strokeWidth={2} />
            </View>
            <View style={styles.methodCopy}>
              <Text style={styles.methodLabel} maxFontSizeMultiplier={1.3}>Use a new card</Text>
              <Text style={styles.methodHint} maxFontSizeMultiplier={1.2}>Enter card on the secure page</Text>
            </View>
            <View style={[styles.radio, (cardChoice === 'new' || !selectedCard) && styles.radioSelected]}>
              {cardChoice === 'new' || !selectedCard ? <Check size={14} color={colors.surface} strokeWidth={3} /> : null}
            </View>
          </Pressable>
          {(cardChoice === 'new' || !selectedCard) ? (
            <Checkbox checked={saveCard} onChange={setSaveCard} label="Save this card for next time" />
          ) : null}
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space[4], gap: space[3] },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space[3],
    paddingHorizontal: space[3],
    borderRadius: radius.tile,
    backgroundColor: colors.green50,
  },
  amountLabel: { ...text.caption, color: colors.green700 },
  amount: { ...text.bodyM, color: colors.green900 },
  methods: { gap: space[2] },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: 64,
    padding: space[3],
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  methodSelected: { borderColor: colors.green500, backgroundColor: colors.green50 },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.tile,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodCopy: { flex: 1, gap: 1 },
  methodLabel: { ...text.bodyM, color: colors.text },
  methodHint: { ...text.caption, color: colors.textMuted },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.green500, backgroundColor: colors.green500 },
  note: { ...text.caption, color: colors.textMuted, textAlign: 'center', marginTop: space[2] },
  payFooter: { paddingBottom: space[8] },
});
