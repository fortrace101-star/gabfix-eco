import AsyncStorage from '@react-native-async-storage/async-storage';

/** The identifier that "Remember me" keeps for the next login. */
const STORAGE_KEY = 'gabfix.login.remembered.v1';

export async function loadRememberedLogin(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const value = raw?.trim();
    return value ? value : null;
  } catch {
    return null;
  }
}

export async function saveRememberedLogin(identifier: string): Promise<void> {
  const value = identifier.trim();
  try {
    if (value) await AsyncStorage.setItem(STORAGE_KEY, value);
    else await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // A storage failure only loses the next prefill; sign-in already succeeded.
  }
}

export async function clearRememberedLogin(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to recover: the login screen simply starts empty.
  }
}
