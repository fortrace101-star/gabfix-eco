import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import {
  Button,
  EmptyState,
  KpiCard,
  PageHeader,
  SectionCard,
  StatusChip,
} from '../components/ui';
import { formatDateTime } from '../lib/format';
import {
  loadSupportMessages,
  loadSupportQueue,
  markSupportRead,
  sendSupportReply,
  updateSupportStatus,
  type SupportConversation,
  type SupportMessage,
  type SupportStatus,
} from '../lib/support';

const statusLabels: Record<SupportStatus, string> = {
  open: 'Open',
  waiting_on_customer: 'Waiting on customer',
  resolved: 'Resolved',
};

const statusTone = (status: SupportStatus): 'warning' | 'info' | 'success' =>
  status === 'open' ? 'warning' : status === 'waiting_on_customer' ? 'info' : 'success';

const categoryLabels: Record<string, string> = {
  booking: 'Booking',
  payment: 'Payment',
  service: 'Service',
  account: 'Account',
  other: 'Other',
};

export function SupportPage({
  notify,
  refreshKey,
}: {
  notify: (message: string) => void;
  refreshKey?: number;
}) {
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const queue = await loadSupportQueue();
      setConversations(queue);
      setSelectedId((current) => current ?? queue[0]?.id ?? null);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not read support threads.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setThreadLoading(true);
    loadSupportMessages(selectedId)
      .then((thread) => {
        if (!cancelled) setMessages(thread);
      })
      .catch((threadError: unknown) => {
        if (!cancelled) {
          setError(
            threadError instanceof Error ? threadError.message : 'Could not open that thread.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setThreadLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, refreshKey]);

  const selected = useMemo(
    () => conversations.find((item) => item.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const open = conversations.filter((item) => item.status === 'open');
  const waiting = conversations.filter((item) => item.status === 'waiting_on_customer');
  const unread = conversations.filter((item) => item.unread);

  const select = async (conversation: SupportConversation) => {
    setSelectedId(conversation.id);
    setReply('');
    setFormError('');
    if (conversation.unread) {
      try {
        await markSupportRead(conversation.id);
        setConversations((current) =>
          current.map((item) =>
            item.id === conversation.id ? { ...item, unread: false } : item,
          ),
        );
      } catch {
        // A read receipt is not worth blocking the thread for.
      }
    }
  };

  const send = async () => {
    if (!selected) return;
    setSending(true);
    setFormError('');
    try {
      await sendSupportReply(selected.id, reply);
      setReply('');
      const thread = await loadSupportMessages(selected.id);
      setMessages(thread);
      await refresh();
      notify(`Reply sent to ${selected.customerName}.`);
    } catch (sendError) {
      setFormError(sendError instanceof Error ? sendError.message : 'Could not send that reply.');
    } finally {
      setSending(false);
    }
  };

  const setStatus = async (status: SupportStatus) => {
    if (!selected) return;
    try {
      await updateSupportStatus(selected.id, status);
      await refresh();
      notify(`${selected.customerName} · ${statusLabels[status].toLowerCase()}.`);
    } catch (statusError) {
      notify(
        statusError instanceof Error ? statusError.message : 'Could not change that thread.',
      );
    }
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Workspace"
        title="Support"
        subtitle="Every customer in-app conversation in one place. Replies from here reach the app immediately; the thread stays resolved until the customer writes again."
        actions={
          <Button icon="refresh" disabled={loading} onClick={() => void refresh()}>
            {loading ? 'Refreshing…' : 'Reload'}
          </Button>
        }
      />

      <div className="kpis">
        <KpiCard
          label="Open threads"
          value={String(open.length)}
          detail="Customers waiting for a first reply"
          icon="messages"
          tone="yellow"
        />
        <KpiCard
          label="Waiting on customer"
          value={String(waiting.length)}
          detail="You replied; the customer has not come back yet"
          icon="clock"
          tone="blue"
        />
        <KpiCard
          label="Unread"
          value={String(unread.length)}
          detail="New messages since the desk last opened the thread"
          icon="bell"
          tone="rose"
        />
        <KpiCard
          label="All conversations"
          value={String(conversations.length)}
          detail="One support thread per customer"
          icon="customers"
        />
      </div>

      {error ? (
        <section className="card restricted" role="alert">
          <h2>Could not load support</h2>
          <p>{error}</p>
          <Button variant="primary" onClick={() => void refresh()}>
            Try again
          </Button>
        </section>
      ) : null}

      <SectionCard title="Inbox" meta="Newest activity first · the app shows the same thread">
        {loading && conversations.length === 0 ? (
          <p className="page-loading" role="status">
            Loading conversations…
          </p>
        ) : conversations.length === 0 ? (
          <EmptyState
            icon="messages"
            title="No conversations yet"
            detail="When a customer writes to Gabfix from the app, the thread arrives here."
          />
        ) : (
          <div className="support-grid">
            <ul className="support-list" aria-label="Support conversations">
              {conversations.map((conversation) => (
                <li key={conversation.id}>
                  <button
                    type="button"
                    className={`support-item${conversation.id === selectedId ? ' support-item-active' : ''}`}
                    onClick={() => void select(conversation)}
                    aria-current={conversation.id === selectedId ? 'true' : undefined}
                  >
                    <span className="support-item-top">
                      <strong>{conversation.customerName}</strong>
                      <span className="cell-sub">
                        {formatDateTime(conversation.lastMessageAt)}
                      </span>
                    </span>
                    <span className="support-item-preview">
                      {conversation.lastMessage || 'No messages yet'}
                    </span>
                    <span className="support-item-meta">
                      <StatusChip
                        label={statusLabels[conversation.status]}
                        tone={statusTone(conversation.status)}
                      />
                      <span className="cell-sub">
                        {categoryLabels[conversation.category] ?? conversation.category} ·{' '}
                        {conversation.reference}
                      </span>
                      {conversation.unread ? <em className="support-unread">New</em> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="support-thread">
              {selected ? (
                <>
                  <header className="support-thread-head">
                    <div>
                      <h3>{selected.customerName}</h3>
                      <p className="cell-sub">
                        {selected.subject || 'Support conversation'} · {selected.phone || 'No phone'}
                      </p>
                    </div>
                    <StatusChip
                      label={statusLabels[selected.status]}
                      tone={statusTone(selected.status)}
                    />
                  </header>

                  <div className="support-messages" aria-live="polite">
                    {threadLoading && messages.length === 0 ? (
                      <p className="page-loading" role="status">
                        Opening the thread…
                      </p>
                    ) : messages.length === 0 ? (
                      <p className="cell-sub">No messages in this thread yet.</p>
                    ) : (
                      messages.map((message) => (
                        <div
                          key={message.id}
                          className={`support-bubble ${message.mine ? 'support-bubble-mine' : ''}`}
                        >
                          <span className="support-bubble-meta">
                            {message.mine ? 'You' : message.senderName} ·{' '}
                            {formatDateTime(message.createdAt)}
                          </span>
                          <p>{message.body}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="support-compose">
                    <textarea
                      className="textarea"
                      rows={3}
                      value={reply}
                      placeholder={`Reply to ${selected.customerName}…`}
                      aria-label="Reply to the customer"
                      onChange={(event) => setReply(event.target.value)}
                    />
                    <div className="support-compose-actions">
                      <div className="row-actions">
                        {selected.status !== 'resolved' ? (
                          <Button
                            className="btn-small"
                            icon="check"
                            onClick={() => void setStatus('resolved')}
                          >
                            Mark resolved
                          </Button>
                        ) : (
                          <Button
                            className="btn-small"
                            icon="refresh"
                            onClick={() => void setStatus('open')}
                          >
                            Reopen
                          </Button>
                        )}
                        {selected.status === 'open' ? (
                          <Button
                            className="btn-small"
                            onClick={() => void setStatus('waiting_on_customer')}
                          >
                            Waiting on customer
                          </Button>
                        ) : null}
                      </div>
                      <Button
                        variant="primary"
                        icon="messages"
                        disabled={sending || reply.trim().length === 0}
                        onClick={() => void send()}
                      >
                        {sending ? 'Sending…' : 'Send reply'}
                      </Button>
                    </div>
                    {formError ? (
                      <p className="form-error">
                        <Icon name="alert" size={14} />
                        {formError}
                      </p>
                    ) : null}
                  </div>
                </>
              ) : (
                <EmptyState
                  icon="messages"
                  title="Pick a conversation"
                  detail="Choose a customer on the left to read the thread and reply."
                />
              )}
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
