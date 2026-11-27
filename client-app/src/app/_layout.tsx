import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppLockGate } from '@/components/auth/app-lock-gate';
import { AppErrorBoundary } from '@/components/ui/error-boundary';
import { ForceUpdateScreen } from '@/components/ui/force-update';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { SessionExpiredModal } from '@/components/ui/session-expired-modal';
import { ToastHost } from '@/components/ui/toast';
import { isUpdateRequired } from '@/config/release';
import { runMockBookingChecks } from '@/lib/assignment';
import { syncPushToken } from '@/lib/push';
import { cleanupDraftMedia } from '@/lib/media';
import { hydrateAddresses } from '@/store/addresses';
import { getBookingDraft, hydrateBookingDraft } from '@/store/booking';
import { hydrateBookings } from '@/store/bookings';
import { refreshDeviceSessions } from '@/store/device-sessions';
import { hydrateLoginActivity } from '@/store/login-activity';
import { hydrateMediaUploads } from '@/store/media-uploads';
import { hydrateMessages, syncBookingThreads } from '@/store/messages';
import { hydrateNotifications } from '@/store/notifications';
import { hydratePaymentMethods } from '@/store/payment-methods';
import { hydratePlans } from '@/store/plans';
import { hydrateProfileSettings } from '@/store/profile-settings';
import { hydrateQuotes } from '@/store/quotes';
import { hydrateReviews } from '@/store/reviews';
import { hydrateSecurity } from '@/store/security';
import { hydrateTickets } from '@/store/tickets';
import { restoreSession, useSession } from '@/store/session';
import { auth } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  const [sessionRestored, setSessionRestored] = useState(false);
  const session = useSession();
  const signedInUserId = session?.user.id ?? null;

  useEffect(() => {
    // Restore before the first screen renders: the splash route needs the session, the order
    // flow needs any saved draft, and the bookings tab needs saved booking history.
    Promise.all([
      restoreSession(),
      hydrateBookingDraft().then(() => {
        cleanupDraftMedia(getBookingDraft()?.media?.items.map((item) => item.uri) ?? []);
      }),
      hydrateBookings(),
      hydratePlans(),
      hydrateAddresses(),
      hydrateQuotes(),
      hydrateTickets(),
      hydratePaymentMethods(),
      hydrateMessages(),
      hydrateNotifications(),
      hydrateProfileSettings(),
      hydrateReviews(),
      hydrateSecurity(),
      hydrateLoginActivity(),
      hydrateMediaUploads(),
      refreshDeviceSessions(),
    ]).finally(() => setSessionRestored(true));
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && sessionRestored) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, sessionRestored]);

  // Push is addressed by device token, so every signed-in launch registers this handset.
  useEffect(() => {
    if (!signedInUserId) return;
    void syncPushToken();
  }, [signedInUserId]);

  // Keeps the Messages badge current while the app is open, including a chat
  // that opens when a technician is assigned.
  useEffect(() => {
    if (!signedInUserId) return;
    void syncBookingThreads();
    const timer = setInterval(() => void syncBookingThreads(), 15_000);
    return () => clearInterval(timer);
  }, [signedInUserId]);

  // S1 12.3/12.4: mock assignment and completion. Runs once after hydration, whenever the
  // app comes back to the foreground, and every 30 s while it is open.
  useEffect(() => {
    if (!sessionRestored) return;
    runMockBookingChecks();
    const timer = setInterval(() => runMockBookingChecks(), 30_000);
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') runMockBookingChecks();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [sessionRestored]);

  if ((!fontsLoaded && !fontError) || !sessionRestored) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
        <AppErrorBoundary>
          {isUpdateRequired() ? (
            <ForceUpdateScreen />
          ) : (
            <>
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: auth.bgTop },
                  animation: 'slide_from_right',
                }}>
                <Stack.Screen name="index" options={{ animation: 'fade' }} />
                <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
                <Stack.Screen name="welcome-back" options={{ animation: 'fade' }} />
                <Stack.Screen name="login" />
                <Stack.Screen name="sign-up" />
                <Stack.Screen name="otp" />
                <Stack.Screen name="forgot-password" />
                <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
                <Stack.Screen
                  name="book/[slug]/details"
                  options={{
                    presentation: Platform.OS === 'ios' ? 'modal' : 'card',
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="book/[slug]/add-ons"
                  options={{
                    presentation: Platform.OS === 'ios' ? 'modal' : 'card',
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="book/[slug]/scope"
                  options={{
                    presentation: Platform.OS === 'ios' ? 'modal' : 'card',
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="book/[slug]/schedule"
                  options={{
                    presentation: Platform.OS === 'ios' ? 'modal' : 'card',
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="book/[slug]/location"
                  options={{
                    presentation: Platform.OS === 'ios' ? 'modal' : 'card',
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="book/[slug]/review"
                  options={{
                    presentation: Platform.OS === 'ios' ? 'modal' : 'card',
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="payment/[id]"
                  options={{
                    presentation: Platform.OS === 'ios' ? 'modal' : 'card',
                    animation: 'slide_from_right',
                    gestureEnabled: false,
                  }}
                />
                <Stack.Screen
                  name="book/[slug]/confirmed"
                  options={{
                    presentation: Platform.OS === 'ios' ? 'modal' : 'card',
                    animation: 'fade',
                    gestureEnabled: false,
                  }}
                />
                <Stack.Screen name="booking/plans" />
                <Stack.Screen name="booking/[id]" />
                <Stack.Screen name="booking/[id]/track" />
                <Stack.Screen name="booking/[id]/receipt" />
                <Stack.Screen name="cleaner/[id]" />
                <Stack.Screen name="policies/[doc]" />
                <Stack.Screen name="quote/[slug]" />
                <Stack.Screen name="refer" />
                <Stack.Screen name="refer/[stage]" />
                <Stack.Screen name="addresses/index" />
                <Stack.Screen name="addresses/[id]" />
                <Stack.Screen name="help/index" />
                <Stack.Screen name="help/faq" />
                <Stack.Screen name="help/contact" />
                <Stack.Screen name="dev/index" />
                <Stack.Screen name="help/tickets" />
                <Stack.Screen name="help/tickets/[id]" />
                <Stack.Screen name="chat/[threadId]" />
                <Stack.Screen name="notifications" />
                <Stack.Screen name="booking/[id]/rate" />
                <Stack.Screen name="profile/edit" />
                <Stack.Screen name="profile/notification-preferences" />
                <Stack.Screen name="profile/security/index" />
                <Stack.Screen name="profile/security/password" />
                <Stack.Screen name="profile/security/two-factor" />
                <Stack.Screen name="profile/security/activity" />
                <Stack.Screen name="profile/devices" />
                <Stack.Screen name="profile/promos" />
                <Stack.Screen name="search" />
                <Stack.Screen name="service/[slug]/reviews" />
                <Stack.Screen name="service/[slug]" />
                <Stack.Screen name="profile/payments" />
              </Stack>
              <OfflineBanner />
              <SessionExpiredModal />
              <ToastHost />
              <AppLockGate />
            </>
          )}
        </AppErrorBoundary>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
