import { router } from 'expo-router';
import { Home, MapPin, MoreHorizontal, Plus, Star, Trash2, Pencil } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TopBar } from '@/components/ui/top-bar';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import {
  deleteAddress,
  setDefaultAddress,
  useAddresses,
  useAddressesHydrated,
  type SavedAddress,
} from '@/store/addresses';
import { colors, font, radius, shadow, space, text } from '@/theme';

function AddressMenu({
  address,
  visible,
  onClose,
}: {
  address: SavedAddress | null;
  visible: boolean;
  onClose: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!address) return null;

  const close = () => {
    setConfirming(false);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onDismiss={close}
      title={confirming ? 'Delete this address?' : address.label}
      subtitle={confirming ? undefined : address.street}
      contentContainerStyle={styles.menuContent}
      footer={
        confirming ? (
          <View style={styles.confirmActions}>
            <Button
              label="Delete address"
              variant="destructive"
              onPress={() => {
                deleteAddress(address.id);
                close();
              }}
              style={styles.fullWidth}
            />
            <Button label="Keep address" variant="ghost" onPress={() => setConfirming(false)} />
          </View>
        ) : undefined
      }>
      {confirming ? (
        <View style={styles.confirm}>
          <View style={styles.confirmIcon}>
            <Trash2 size={24} color={colors.error} strokeWidth={2} />
          </View>
          <Text style={styles.confirmBody} maxFontSizeMultiplier={1.3}>
            {address.street} will be removed from your address book. Bookings that already use it
            keep their address.
          </Text>
        </View>
      ) : (
        <>
          <MenuRow
            icon={Pencil}
            label="Edit address"
            onPress={() => {
              close();
              router.push({ pathname: '/addresses/[id]', params: { id: address.id } });
            }}
          />
          {!address.isDefault ? (
            <MenuRow
              icon={Star}
              label="Set as default"
              onPress={() => {
                setDefaultAddress(address.id);
                close();
              }}
            />
          ) : null}
          <MenuRow
            icon={Trash2}
            label="Delete address"
            destructive
            onPress={() => setConfirming(true)}
          />
        </>
      )}
    </BottomSheet>
  );
}

function MenuRow({
  icon: Icon,
  label,
  onPress,
  destructive,
}: {
  icon: typeof Pencil;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.menuRow}>
      <View style={[styles.menuIcon, destructive && styles.menuIconDanger]}>
        <Icon size={20} color={destructive ? colors.error : colors.green700} strokeWidth={2} />
      </View>
      <Text
        style={[styles.menuLabel, destructive && styles.menuLabelDanger]}
        maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
    </Pressable>
  );
}

function AddressCard({ address, onMenu }: { address: SavedAddress; onMenu: () => void }) {
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${address.label} address, ${address.street}`}
        onPress={() => router.push({ pathname: '/addresses/[id]', params: { id: address.id } })}
        style={styles.cardPress}>
        <View style={styles.cardTop}>
          <View style={styles.labelPill}>
            <Home size={14} color={colors.green700} strokeWidth={2} />
            <Text style={styles.labelText} maxFontSizeMultiplier={1.2}>
              {address.label}
            </Text>
          </View>
          {address.isDefault ? (
            <View style={styles.defaultPill}>
              <View style={styles.defaultDot} />
              <Text style={styles.defaultText} maxFontSizeMultiplier={1.2}>
                Default
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.street} maxFontSizeMultiplier={1.3}>
          {address.street}
        </Text>
        {address.landmark ? (
          <Text style={styles.landmark} maxFontSizeMultiplier={1.3} numberOfLines={2}>
            {address.landmark}
          </Text>
        ) : null}
        <View style={styles.areaRow}>
          <MapPin size={14} color={colors.textMuted} strokeWidth={2} />
          <Text style={styles.area} maxFontSizeMultiplier={1.2}>
            {address.area} · {address.propertyType}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Manage ${address.label} address`}
        hitSlop={8}
        onPress={onMenu}
        style={styles.more}>
        <MoreHorizontal size={22} color={colors.textMuted} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

/** P24 saved addresses. P11 reads this list when choosing where to clean. */
export default function AddressesScreen() {
  const addresses = useAddresses();
  const hydrated = useAddressesHydrated();
  const [menuId, setMenuId] = useState<string | null>(null);
  const menuAddress = addresses.find((address) => address.id === menuId) ?? null;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <TopBar
        title="Saved addresses"
        onBack={() => router.back()}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a new address"
            hitSlop={8}
            onPress={() => router.push({ pathname: '/addresses/[id]', params: { id: 'new' } })}
            style={styles.addTop}>
            <Plus size={22} color={colors.green700} strokeWidth={2} />
          </Pressable>
        }
      />
      <FlatList
        data={hydrated ? addresses : []}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, hydrated && addresses.length === 0 && styles.emptyContent]}
        renderItem={({ item }) => (
          <AddressCard address={item} onMenu={() => setMenuId(item.id)} />
        )}
        ListEmptyComponent={
          hydrated ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <MapPin size={28} color={colors.green700} strokeWidth={2} />
              </View>
              <Text style={styles.emptyTitle} maxFontSizeMultiplier={1.3}>
                No saved addresses
              </Text>
              <Text style={styles.emptyBody} maxFontSizeMultiplier={1.3}>
                Add the places you clean most. They will be ready to pick whenever you book.
              </Text>
              <Button
                label="Add an address"
                onPress={() => router.push({ pathname: '/addresses/[id]', params: { id: 'new' } })}
              />
            </View>
          ) : undefined
        }
        ListFooterComponent={
          hydrated && addresses.length > 0 ? (
            <Button
              label="Add a new address"
              variant="secondary"
              icon={Plus}
              onPress={() => router.push({ pathname: '/addresses/[id]', params: { id: 'new' } })}
            />
          ) : undefined
        }
      />
      <AddressMenu address={menuAddress} visible={Boolean(menuAddress)} onClose={() => setMenuId(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  addTop: { width: 48, height: 48, alignItems: 'flex-end', justifyContent: 'center' },
  content: { padding: space[4], paddingBottom: 120, gap: space[3] },
  emptyContent: { flexGrow: 1, justifyContent: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    ...shadow.card,
  },
  cardPress: { padding: space[4], gap: space[2], borderRadius: radius.card },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingRight: 44,
  },
  labelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.green50,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  labelText: { ...text.caption, color: colors.green700, fontFamily: font.bodySemi },
  defaultPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.yellow50,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  defaultDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.yellow600 },
  defaultText: { ...text.caption, fontSize: 11, color: colors.yellow800 },
  more: {
    position: 'absolute',
    top: space[2],
    right: space[2],
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  street: { ...text.bodyL, color: colors.text, fontFamily: font.bodyMedium },
  landmark: { ...text.caption, color: colors.textMuted },
  areaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  area: { ...text.caption, color: colors.textMuted, textTransform: 'capitalize' },
  empty: { alignItems: 'center', paddingHorizontal: space[6], gap: space[2] },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.green50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[1],
  },
  emptyTitle: { ...text.h3, color: colors.text, textAlign: 'center' },
  emptyBody: { ...text.bodyM, color: colors.textMuted, textAlign: 'center', marginBottom: space[2] },
  menuContent: { paddingHorizontal: space[4], paddingTop: space[2] },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.tile,
    backgroundColor: colors.green50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconDanger: { backgroundColor: colors.errorBg },
  menuLabel: { ...text.bodyM, color: colors.text },
  menuLabelDanger: { color: colors.error },
  confirm: { alignItems: 'center', gap: space[3], paddingVertical: space[4], paddingHorizontal: space[4] },
  confirmActions: { gap: space[1] },
  confirmIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.errorBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBody: { ...text.bodyM, color: colors.textMuted, textAlign: 'center' },
  fullWidth: { alignSelf: 'stretch' },
});
