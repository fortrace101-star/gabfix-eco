import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, space, text } from '@/theme';

export function useIsOnline() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    });
    void NetInfo.fetch().then((state) => {
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    });
    return unsubscribe;
  }, []);

  return online;
}

/** Shown above list content while the device has no usable connection. */
export function OfflineBanner() {
  const online = useIsOnline();
  if (online) return null;

  return (
    <View accessibilityRole="alert" style={styles.banner}>
      <Text style={styles.title}>You&apos;re offline</Text>
      <Text style={styles.body}>
        Showing the last data we loaded. Actions and photo uploads will retry when you reconnect.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: space[4],
    marginBottom: space[2],
    padding: space[3],
    gap: 2,
    borderRadius: radius.input,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  title: { ...text.bodyM, color: colors.yellow800 },
  body: { ...text.caption, color: colors.yellow800 },
});
