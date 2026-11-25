import { supabase } from './supabase';

export type SupportStatus = 'open' | 'waiting_on_customer' | 'resolved';
export type SupportCategory = 'booking' | 'payment' | 'service' | 'account' | 'other';

export type SupportConversation = {
  id: string;
  reference: string;
  customerId: string;
  customerName: string;
  phone: string;
  subject: string | null;
  category: SupportCategory;
  status: SupportStatus;
  lastMessageAt: string;
  lastMessage: string;
  unread: boolean;
};

export type SupportMessage = {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
  senderName: string;
};

export async function loadSupportQueue(): Promise<SupportConversation[]> {
  const [conversationsRes, profilesRes, messagesRes] = await Promise.all([
    supabase
      .from('support_conversations')
      .select(
        'id, reference, customer_id, subject, category, status, last_message_at, last_read_by_staff_at',
      )
      .order('last_message_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, phone'),
    supabase
      .from('support_messages')
      .select('conversation_id, body, created_at')
      .order('created_at', { ascending: false }),
  ]);

  const failure = conversationsRes.error ?? profilesRes.error ?? messagesRes.error;
  if (failure) throw new Error(failure.message);

  const profileById = new Map((profilesRes.data ?? []).map((row) => [row.id, row]));
  const lastByConversation = new Map<string, string>();
  for (const message of messagesRes.data ?? []) {
    if (!lastByConversation.has(message.conversation_id)) {
      lastByConversation.set(message.conversation_id, message.body);
    }
  }

  return (conversationsRes.data ?? []).map((row) => {
    const profile = profileById.get(row.customer_id);
    const lastRead = row.last_read_by_staff_at ? new Date(row.last_read_by_staff_at).getTime() : 0;
    const lastMessageAt = new Date(row.last_message_at).getTime();
    return {
      id: row.id,
      reference: row.reference,
      customerId: row.customer_id,
      customerName: profile?.full_name ?? 'Customer',
      phone: profile?.phone ?? '',
      subject: row.subject,
      category: row.category as SupportCategory,
      status: row.status as SupportStatus,
      lastMessageAt: row.last_message_at,
      lastMessage: lastByConversation.get(row.id) ?? '',
      unread: lastMessageAt > lastRead,
    };
  });
}

export async function loadSupportMessages(conversationId: string): Promise<SupportMessage[]> {
  const [{ data: auth }, messagesRes, profilesRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('support_messages')
      .select('id, sender_id, body, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true }),
    supabase.from('profiles').select('id, auth_user_id, full_name'),
  ]);

  if (messagesRes.error) throw new Error(messagesRes.error.message);
  if (profilesRes.error) throw new Error(profilesRes.error.message);

  const myAuthId = auth.user?.id ?? null;
  const myProfileId =
    (profilesRes.data ?? []).find((row) => row.auth_user_id === myAuthId)?.id ?? null;
  const nameById = new Map((profilesRes.data ?? []).map((row) => [row.id, row.full_name]));

  return (messagesRes.data ?? []).map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    mine: row.sender_id === myProfileId,
    senderName: nameById.get(row.sender_id) ?? 'Gabfix',
  }));
}

export async function sendSupportReply(conversationId: string, body: string): Promise<void> {
  const text = body.trim();
  if (!text) throw new Error('Write a reply first.');

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('Your session expired. Sign in again.');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_user_id', auth.user.id)
    .maybeSingle();
  if (profileError || !profile) throw new Error(profileError?.message ?? 'No staff profile found.');

  const { error } = await supabase.from('support_messages').insert({
    conversation_id: conversationId,
    sender_id: profile.id,
    body: text,
  });
  if (error) throw new Error(error.message);

  await supabase
    .from('support_conversations')
    .update({ last_read_by_staff_at: new Date().toISOString(), status: 'waiting_on_customer' })
    .eq('id', conversationId);
}

export async function updateSupportStatus(
  conversationId: string,
  status: SupportStatus,
): Promise<void> {
  const { error } = await supabase
    .from('support_conversations')
    .update({
      status,
      last_read_by_staff_at: new Date().toISOString(),
    })
    .eq('id', conversationId);
  if (error) throw new Error(error.message);
}

export async function markSupportRead(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('support_conversations')
    .update({ last_read_by_staff_at: new Date().toISOString() })
    .eq('id', conversationId);
  if (error) throw new Error(error.message);
}
