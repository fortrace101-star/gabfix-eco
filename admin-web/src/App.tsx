import { useCallback, useEffect, useRef, useState } from 'react';
import { Login } from './components/Login';
import { Sidebar } from './components/Sidebar';
import { Topbar, type DateRange } from './components/Topbar';
import { Toast } from './components/ui';
import {
  initialPromos,
  initialRateCard,
  initialSettings,
  notificationsSeed,
} from './data';
import { canViewPage, restoreSession, signOut, type AdminUser } from './lib/auth';
import { subscribeToOperations, type LiveStatus } from './lib/live';
import { assignTechnician, confirmCashHandover, loadConsoleData } from './lib/queries';
import { ApprovalsPage } from './pages/Approvals';
import { BookingsPage } from './pages/Bookings';
import { CataloguePage } from './pages/Catalogue';
import { QuotesPage } from './pages/Quotes';
import { CashPage } from './pages/Cash';
import { CostsPage } from './pages/Costs';
import { SupportPage } from './pages/Support';
import { CleanersPage } from './pages/Cleaners';
import { CustomersPage } from './pages/Customers';
import { FormsPage } from './pages/Forms';
import { Overview } from './pages/Overview';
import { PaymentsPage } from './pages/Payments';
import { PromosPage } from './pages/Promos';
import { ReportsPage } from './pages/Reports';
import { ServicesPage } from './pages/Services';
import { SettingsPage } from './pages/Settings';
import type {
  Booking,
  CashCollection,
  Cleaner,
  Customer,
  OperationsSettings,
  PageId,
  Payment,
  Promo,
  RateCard,
} from './types';

const pages: PageId[] = [
  'overview',
  'bookings',
  'approvals',
  'quotes',
  'payments',
  'cash',
  'customers',
  'cleaners',
  'catalogue',
  'support',
  'costs',
  'services',
  'forms',
  'promos',
  'reports',
  'settings',
];

const pageTitles: Record<PageId, string> = {
  overview: 'Operations overview',
  bookings: 'Bookings',
  approvals: 'Approvals',
  quotes: 'Quotes & inspections',
  support: 'Support',
  costs: 'Job costs',
  payments: 'Payments',
  cash: 'Cash collections',
  customers: 'Customers',
  cleaners: 'Cleaners',
  catalogue: 'Service catalogue',
  services: 'Services & pricing',
  forms: 'Booking forms',
  promos: 'Promos',
  reports: 'Reports',
  settings: 'Settings',
};

const pageFromHash = (): PageId => {
  const candidate = window.location.hash.replace(/^#\/?/, '') as PageId;
  return pages.includes(candidate) ? candidate : 'overview';
};

export default function App() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState<PageId>(pageFromHash);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>('Last 7 days');
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  /** Bumped on a realtime change so pages that load their own data reload too. */
  const [liveTick, setLiveTick] = useState(0);
  const [live, setLive] = useState<LiveStatus>('connecting');

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [cash, setCash] = useState<CashCollection[]>([]);
  const [promos, setPromos] = useState<Promo[]>(initialPromos);
  const [rateCard, setRateCard] = useState<RateCard>(initialRateCard);
  const [settings, setSettings] = useState<OperationsSettings>(initialSettings);
  const [readNotifications, setReadNotifications] = useState<string[]>([]);

  const notify = useCallback((message: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => setToast(null), 3600);
  }, []);

  const refresh = useCallback(async () => {
    setLoadingData(true);
    try {
      const data = await loadConsoleData();
      setBookings(data.bookings);
      setCleaners(data.cleaners);
      setCustomers(data.customers);
      setPayments(data.payments);
      setCash(data.cash);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not read the operations data.');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    restoreSession()
      .then((restored) => {
        if (!cancelled) setUser(restored);
      })
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (user) void refresh();
  }, [user, refresh]);

  // The desk acts in other apps; reload instead of making someone press refresh.
  useEffect(() => {
    if (!user) return;
    const stop = subscribeToOperations(() => {
      setLiveTick((value) => value + 1);
      void refresh();
    }, setLive);
    return stop;
  }, [user, refresh]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    document.title = `${pageTitles[page]} · Gabfix Operations`;
  }, [page]);

  const navigate = useCallback((next: PageId) => {
    setPage(next);
    setMobileOpen(false);
    if (window.location.hash !== `#/${next}`) window.location.hash = `#/${next}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const assignBooking = async (bookingId: string, cleanerId: string) => {
    const cleaner = cleaners.find((item) => item.id === cleanerId);
    try {
      await assignTechnician(bookingId, cleanerId);
      await refresh();
      notify(cleaner ? `${cleaner.name} assigned to ${bookingId}.` : `${bookingId} updated.`);
    } catch (error) {
      notify(error instanceof Error ? `Assignment failed: ${error.message}` : 'Assignment failed.');
    }
  };

  const markRemitted = async (id: string) => {
    const entry = cash.find((item) => item.id === id);
    if (!entry || !user) return;
    try {
      await confirmCashHandover(entry.cleanerId, entry.amountDue);
      await refresh();
      notify(
        `${entry.cleaner} marked remitted · ${entry.amountDue.toLocaleString('en-UG')} UGX.`,
      );
    } catch (error) {
      notify(error instanceof Error ? `Handover failed: ${error.message}` : 'Handover failed.');
    }
  };

  const resolveDispute = (id: string) => {
    const entry = cash.find((item) => item.id === id);
    setCash((current) =>
      current.map((item) => (item.id === id ? { ...item, dispute: undefined } : item)),
    );
    if (entry) {
      setCleaners((current) =>
        current.map((cleaner) =>
          cleaner.id === entry.cleanerId ? { ...cleaner, cashDispute: undefined } : cleaner,
        ),
      );
      notify(`${entry.cleaner}'s cash dispute was resolved.`);
    }
  };

  const retryPayment = (id: string) => {
    const payment = payments.find((item) => item.id === id);
    // A retried charge keeps its original instalment role; only the status changes.
    const booking = bookings.find((item) => item.id === payment?.bookingId);
    const kind = booking && booking.paid > 0 ? 'Balance' : 'Deposit';
    setPayments((current) =>
      current.map((item) =>
        item.id === id ? { ...item, kind, status: 'Received' } : item,
      ),
    );
    notify(payment ? `Retry approved for ${payment.bookingId}.` : 'Payment retried.');
  };

  const reconcilePayment = (id: string) => {
    const payment = payments.find((item) => item.id === id);
    setPayments((current) =>
      current.map((item) => (item.id === id ? { ...item, status: 'Reconciled' } : item)),
    );
    notify(payment ? `${payment.bookingId} reconciled with the provider.` : 'Payment reconciled.');
  };

  const toggleAvailability = (id: string) => {
    const cleaner = cleaners.find((item) => item.id === id);
    setCleaners((current) =>
      current.map((item) => (item.id === id ? { ...item, available: !item.available } : item)),
    );
    if (cleaner) {
      notify(`${cleaner.name} is now ${cleaner.available ? 'off duty' : 'available'}.`);
    }
  };

  const verifyCleaner = (id: string) => {
    const cleaner = cleaners.find((item) => item.id === id);
    setCleaners((current) =>
      current.map((item) => (item.id === id ? { ...item, verified: true } : item)),
    );
    notify(cleaner ? `${cleaner.name} verified.` : 'Cleaner verified.');
  };

  const togglePromo = (id: string) => {
    const promo = promos.find((item) => item.id === id);
    setPromos((current) =>
      current.map((item) => (item.id === id ? { ...item, active: !item.active } : item)),
    );
    if (promo) notify(`${promo.code} ${promo.active ? 'paused' : 'activated'}.`);
  };

  const createPromo = (promo: Promo) => {
    setPromos((current) => [promo, ...current]);
  };

  const saveRateCard = (next: RateCard) => {
    setRateCard(next);
    notify('Rate card updated for this session.');
  };

  const saveSettings = (next: OperationsSettings) => {
    setSettings(next);
    notify('Operations settings updated for this session.');
  };

  const handleSignOut = () => {
    void signOut();
    setUser(null);
    setBookings([]);
    setCleaners([]);
    setCustomers([]);
    setPayments([]);
    setCash([]);
  };

  if (restoring) {
    return (
      <div className="auth-shell">
        <section className="auth-card">
          <p className="auth-eyebrow">Gabfix Operations</p>
          <h1>Loading…</h1>
          <p>Checking your session.</p>
        </section>
      </div>
    );
  }

  if (!user) return <Login onSignedIn={setUser} />;

  return (
    <div className="app">
      <Sidebar
        active={page}
        mobileOpen={mobileOpen}
        onNavigate={navigate}
        onCloseMobile={() => setMobileOpen(false)}
        user={user}
        role={user.role}
        onSignOut={handleSignOut}
      />
      <div className="main">
        <Topbar
          page={page}
          bookings={bookings}
          customers={customers}
          cleaners={cleaners}
          dateRange={dateRange}
          onDateRange={setDateRange}
          onNavigate={navigate}
          onOpenMobile={() => setMobileOpen(true)}
          notifications={notificationsSeed}
          readNotifications={readNotifications}
          onReadNotification={(id) => {
            setReadNotifications((current) =>
              current.includes(id) ? current : [...current, id],
            );
          }}
          onReadAll={() => setReadNotifications(notificationsSeed.map((item) => item.id))}
          live={live}
        />
        <main className="page-wrap">
          {loadError ? (
            <section className="card restricted" role="alert">
              <h2>Could not load operations data</h2>
              <p>{loadError}</p>
              <button type="button" className="btn btn-primary" onClick={() => void refresh()}>
                Try again
              </button>
            </section>
          ) : null}
          {loadingData && !loadError ? (
            <p className="page-loading" role="status">
              Loading the latest data…
            </p>
          ) : null}
          {page === 'overview' ? (
            <Overview
              bookings={bookings}
              cleaners={cleaners}
              cash={cash}
              payments={payments}
              dateRange={dateRange}
              userName={user.name}
              onNavigate={navigate}
              onAssign={assignBooking}
              notify={notify}
            />
          ) : null}
          {page === 'bookings' ? (
            <BookingsPage bookings={bookings} cleaners={cleaners} onAssign={assignBooking} />
          ) : null}
          {page === 'approvals' ? (
            <ApprovalsPage user={user} notify={notify} refreshKey={liveTick} />
          ) : null}
          {page === 'payments' ? (
            <PaymentsPage
              payments={payments}
              bookings={bookings}
              onRetry={retryPayment}
              onReconcile={reconcilePayment}
              notify={notify}
            />
          ) : null}
          {page === 'cash' ? (
            <CashPage
              cash={cash}
              cleaners={cleaners}
              reminderHours={settings.cashReminderHours}
              onMarkRemitted={markRemitted}
              onResolveDispute={resolveDispute}
              notify={notify}
            />
          ) : null}
          {page === 'customers' ? (
            <CustomersPage customers={customers} bookings={bookings} notify={notify} />
          ) : null}
          {page === 'cleaners' ? (
            <CleanersPage
              cleaners={cleaners}
              bookings={bookings}
              onToggleAvailability={toggleAvailability}
              onVerify={verifyCleaner}
              notify={notify}
            />
          ) : null}
          {page === 'catalogue' ? <CataloguePage notify={notify} /> : null}
          {page === 'quotes' ? (
            <QuotesPage user={user} notify={notify} refreshKey={liveTick} />
          ) : null}
          {page === 'support' ? (
            <SupportPage notify={notify} refreshKey={liveTick} />
          ) : null}
          {page === 'costs' ? (
            <CostsPage role={user.role} notify={notify} refreshKey={liveTick} />
          ) : null}
          {page === 'services' ? (
            <ServicesPage rateCard={rateCard} onSave={saveRateCard} />
          ) : null}
          {page === 'forms' ? <FormsPage user={user} notify={notify} /> : null}
          {page === 'promos' ? (
            <PromosPage
              promos={promos}
              onToggle={togglePromo}
              onCreate={createPromo}
              notify={notify}
            />
          ) : null}
          {page === 'reports' ? (
            <ReportsPage
              bookings={bookings}
              payments={payments}
              cash={cash}
              customers={customers}
              cleaners={cleaners}
              notify={notify}
            />
          ) : null}
          {page === 'settings' ? (
            canViewPage('settings', user.role) ? (
              <SettingsPage settings={settings} onSave={saveSettings} />
            ) : (
              <section className="card restricted" role="alert">
                <h2>Settings is owner-only</h2>
                <p>
                  Ask an owner to change operations settings. Bookings, payments and the
                  catalogue are still available to your role.
                </p>
              </section>
            )
          ) : null}
        </main>
        <Toast message={toast} />
      </div>
    </div>
  );
}
