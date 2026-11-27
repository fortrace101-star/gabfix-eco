# ERP App Fixes: Start Route, Missing Tab Bar, Payments

Investigation notes for gabfix-eco (erp-app and admin-web). Findings come from reading the code in the uploaded zip; nothing was run.

## Summary

| Issue | Where | Status |
| --- | --- | --- |
| ERP app opens on Alerts instead of Home | `erp-app/src/app/(app)/_layout.tsx`, `src/store/auth.tsx` | Cause found, fix below |
| Tab bar missing after load | Same files | Same cause |
| Payments page shows only failed transactions | `admin-web/src/pages/Payments.tsx`, `src/lib/queries.ts` | No code cause found; check the data |

## Issue 1: App opens on Alerts and the tab bar is empty

### Cause

Every main tab (home, chat, jobs, schedule, cash, profile) is declared with `href: visible(tab) ? undefined : null`. The `visible()` helper returns `false` whenever `role` is `null`.

`role` can still be `null` when the layout first renders:

- In `auth.tsx`, `onAuthStateChange` sets `status` to `signedIn` immediately, while the profile loads asynchronously.
- If `loadProfile` fails (network error, RLS, or no `profiles` row for that auth user), the profile stays `null` but the status still says `signedIn`.

With `role` null, all six main tabs are hidden. The `notifications` and `inspections` screens have no `href: null`, so the router starts on Alerts rather than the `home` anchor. The custom tab bar also filters out `notifications`, `inspections` and `index`, so it renders with no items.

How to tell the two cases apart: if the bar returns after a moment, it is a race. If it never returns, the profile query is failing. Check that the signed-in user has a row in `profiles` and can read it.

### Fix 1: `erp-app/src/app/(app)/_layout.tsx`

Pin the initial route, hide the non-tab routes from the tab list, and do not render the tabs until the profile is known.

```tsx
export default function AppLayout() {
  const { role, profile, status, signOut } = useAuth();

  // Signed in but profile not loaded yet (or failed): do not render tabs with a null role.
  if (status === 'signedIn' && !profile) {
    return (
      <View style={styles.deactivated}>
        <Text style={styles.deactivatedTitle}>Loading your account…</Text>
        <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
      </View>
    );
  }

  // ...existing deactivated-account check stays as is...

  const visible = (tab: TabRole) => (role ? VISIBLE_FOR[tab].includes(role) : false);

  return (
    <Tabs
      initialRouteName="home"
      backBehavior="initialRoute"
      tabBar={(props) => <BrandTabBar {...props} hiddenRoutes={HIDDEN_ROUTES} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { minHeight: size.tabBar },
        sceneStyle: { backgroundColor: colors.bg },
      }}>
      {/* home, chat, jobs, schedule, cash, profile screens unchanged */}

      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ title: 'Alerts', href: null }} />
      <Tabs.Screen name="inspections" options={{ title: 'Inspections', href: null }} />
    </Tabs>
  );
}
```

`href: null` only removes a screen from the tab list. `router.push('/notifications')` and `router.push('/inspections')` from the Home screen still work, and the bar stays visible because those routes live inside the tabs.

### Fix 2: `erp-app/src/store/auth.tsx`

Only report `signedIn` once the profile load has finished.

```tsx
const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
  setSession(nextSession);
  if (!nextSession) {
    void loadProfile(null);
    setStatus('signedOut');
    return;
  }
  void loadProfile(nextSession).finally(() => setStatus('signedIn'));
});
```

Also give the user a way out when `loadProfile` returns no profile. Today that case leaves them stuck on an empty screen. The loading view in Fix 1 includes a Sign out button for this reason.

### How to verify

1. Fully close the app and reopen it while signed in. It should land on Home with the tab bar visible.
2. Tap the bell on Home. Alerts should open with the tab bar still showing.
3. Sign in as a user with no `profiles` row. You should see the loading/sign-out screen, not an empty app.

## Issue 2: Payments page shows only failed transactions

### What the code does

No code in the uploaded zip restricts the list to failed payments.

- `Payments.tsx` starts on the **All** tab. The filter only narrows when another tab is chosen.
- `statusLabel` in `queries.ts` maps `paid` to Received, `pending` to Pending, `refunded` to Refunded, and anything else to Failed.
- `kindLabel` marks a row as a failed payment only when `status === 'failed'`.
- The database enum is `pending | paid | failed | refunded`, so the mapping matches.
- The read policies on `payments` do not filter by status.

The UI therefore shows whatever statuses are stored. The most likely explanation is the data.

### Step 1: check the table

```sql
select status, count(*) from public.payments group by 1;
```

- **All rows are `failed`:** something is writing or updating rows with the wrong status. The backend insert at `POST /bookings/:id/payments` in `backend/supabase/functions/api/index.ts` (around line 1557) writes `status: 'paid'`, so look for any other writer or manual update.
- **Mixed statuses but the page still shows only failures:** you may be running a different build or screen than the one in this zip.

### Step 2: if you need a safeguard in the UI

The fallback in `statusLabel` turns any unexpected value into Failed, which can hide problems. Making it explicit surfaces bad data instead of mislabelling it:

```ts
const statusLabel = (status: string): Payment['status'] => {
  switch (status) {
    case 'paid': return 'Received';
    case 'pending': return 'Pending';
    case 'refunded': return 'Refunded';
    case 'failed': return 'Failed';
    default:
      console.warn('Unknown payment status', status);
      return 'Pending';
  }
};
```

### Open question

If the SQL check shows healthy data, tell us which app and page you mean by "Payment processing" and share a screenshot, and the investigation can continue from there.
