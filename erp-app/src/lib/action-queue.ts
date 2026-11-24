import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';

export type QueuedAction =
  | {
      id: string;
      kind: 'rpc';
      name: 'set_booking_on_the_way' | 'start_job' | 'complete_job';
      params: { p_booking: string; p_billed_hours?: number };
      label: string;
      createdAt: string;
    }
  | {
      id: string;
      kind: 'cash';
      params: { p_booking: string; p_amount: number };
      label: string;
      createdAt: string;
    };

export type NewAction =
  | {
      kind: 'rpc';
      name: 'set_booking_on_the_way' | 'start_job' | 'complete_job';
      params: { p_booking: string; p_billed_hours?: number };
      label: string;
    }
  | {
      kind: 'cash';
      params: { p_booking: string; p_amount: number };
      label: string;
    };

const QUEUE_KEY = 'gabfix.portal.action-queue';

const randomId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export function isOfflineError(message: string): boolean {
  return /failed to fetch|network request failed|network error|load failed|offline|timeout/i.test(
    message,
  );
}

async function readQueue(): Promise<QueuedAction[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const parsed = raw ? (JSON.parse(raw) as QueuedAction[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedAction[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function queueAction(action: NewAction): Promise<void> {
  const queue = await readQueue();
  const entry = { ...action, id: randomId(), createdAt: new Date().toISOString() } as QueuedAction;
  await writeQueue([...queue, entry]);
}

export async function pendingActionCount(): Promise<number> {
  return (await readQueue()).length;
}

/** Replay every queued action once. Offline failures stay queued in their original order. */
export async function flushActionQueue(): Promise<{ done: number; remaining: number }> {
  const queue = await readQueue();
  if (!queue.length) return { done: 0, remaining: 0 };

  const remaining: QueuedAction[] = [];
  let done = 0;

  for (const action of queue) {
    const { error } =
      action.kind === 'cash'
        ? await supabase.rpc('record_cash_payment', action.params)
        : await supabase.rpc(action.name, action.params);

    if (error) {
      remaining.push(action);
    } else {
      done += 1;
    }
  }

  await writeQueue(remaining);
  return { done, remaining: remaining.length };
}
