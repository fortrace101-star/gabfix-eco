# Gabfix Portal (erp-app): release APK crashes on launch

## Symptom

The preview APK shows the green splash screen and then closes. The client app works.

## Root cause

`adb logcat` showed this fatal error:

```
com.facebook.react.common.JavascriptException:
TypeError: Cannot read property 'hostname' of undefined
```

It comes from `erp-app/src/lib/env.ts`, line 21:

```ts
const pageHost = typeof window !== 'undefined' ? window.location.hostname : '';
```

In React Native, `window` is defined (it aliases the global object) but `window.location` is not,
so `window.location.hostname` throws. The expression is evaluated before the
`Platform.OS === 'web'` check, so it runs on native too. It throws while the first route's
modules load, before anything renders, so the splash screen never hides and the app closes.

It does not crash in dev because Expo's dev runtime provides `window.location`. A release build does not.

## Fix 1: `erp-app/src/lib/env.ts`

Replace `resolveDevUrl` with:

```ts
function resolveDevUrl(url: string) {
  const host =
    Platform.OS === 'web'
      ? typeof window !== 'undefined'
        ? window.location?.hostname
        : undefined
      : Constants.expoConfig?.hostUri?.split(':')[0];
  if (!host || LOOPBACK.has(host)) return url;
  return url.replace(/\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/, `//${host}`);
}
```

`window.location` is now read only on web, with optional chaining. On a native release build
`hostUri` is undefined, so `host` is falsy and the URL is returned unchanged, which is correct
for a hosted Supabase project.

## Fix 2: Supabase env vars in the build (already done, keep it)

`EXPO_PUBLIC_*` values are inlined at build time. Gitignored `.env` / `.env.local` files are not
uploaded to EAS, so they must be set in `erp-app/eas.json`:

```json
"preview": {
  "distribution": "internal",
  "autoIncrement": true,
  "android": { "buildType": "apk" },
  "env": {
    "EXPO_PUBLIC_SUPABASE_URL": "https://YOUR-PROJECT.supabase.co",
    "EXPO_PUBLIC_SUPABASE_ANON_KEY": "YOUR_ANON_KEY"
  }
}
```

Or use EAS environment variables (plaintext visibility, not secret):

```
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://YOUR-PROJECT.supabase.co --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value YOUR_ANON_KEY --visibility plaintext
```

Notes:
- Use the hosted URL, not `127.0.0.1` (that points at the phone itself).
- Use the anon key only. Never put the service-role key in the app.
- Without these variables, `env.ts` throws "Missing EXPO_PUBLIC_SUPABASE_URL..." at startup.
  That produces the same green-screen-then-close symptom.

## Rebuild

```
eas build -p android --profile preview
```

Uninstall the old APK from the phone first.

## Verifying / diagnosing a crash with adb

1. Enable Developer options (Settings > About phone > Software information > tap Build number 7 times),
   then turn on USB debugging. On Windows, install the Samsung USB driver for Samsung phones.
2. From the platform-tools folder (in PowerShell, prefix commands with `.\`):

```
adb devices
adb logcat -b all -c
# open the app and wait for it to close
adb logcat -b crash -d
```

3. The `FATAL EXCEPTION` / `JavascriptException` lines name the actual error.
   Package name: `ug.gabfix.portal`.

## Optional hardening

`env.ts` throws at import time when the Supabase variables are missing, which hides the message
in release builds. Consider exporting an `envError` string instead and rendering a
"Configuration error" screen from the root layout so a misconfigured build shows a message.
