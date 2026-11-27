import { useState } from 'react';
import { AreaBars, RevenueChart } from '../components/charts';
import { AssignCleanerDialog } from '../components/AssignCleanerDialog';
import { Icon } from '../components/Icon';
import {
  Avatar,
  Button,
  KpiCard,
  SectionCard,
  StatusChip,
} from '../components/ui';
import type { DateRange } from '../components/Topbar';
import { cashOlderThan, TODAY } from '../data';
import { compactUgx, formatShortDate, ugx } from '../lib/format';
import type { Booking, CashCollection, Cleaner, PageId, Payment } from '../types';

export function Overview({
  bookings,
  cleaners,
  cash,
  payments,
  dateRange,
  userName,
  onNavigate,
  onAssign,
  notify,
}: {
  bookings: Booking[];
  cleaners: Cleaner[];
  cash: CashCollection[];
  payments: Payment[];
  dateRange: DateRange;
  userName: string;
  onNavigate: (page: PageId) => void;
  onAssign: (bookingId: string, cleanerId: string) => void;
  notify: (message: string) => void;
}) {
  const [assigning, setAssigning] = useState<Booking | null>(null);
  const liveBookings = bookings.filter((booking) => booking.dateISO === TODAY);
  const activeCleaners = cleaners.filter((cleaner) => cleaner.available);
  const busyCleaners = cleaners.filter((cleaner) => !cleaner.available);
  const averageRating = cleaners.length
    ? (cleaners.reduce((sum, cleaner) => sum + cleaner.rating, 0) / cleaners.length).toFixed(1)
    : '—';
  const todayLabel = new Date(`${TODAY}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const unassigned = bookings.filter(
    (booking) =>
      !booking.cleanerId &&
      (booking.status === 'Pending' || booking.status === 'Confirmed') &&
      booking.dateISO >= TODAY,
  );
  const overdueBalances = bookings.filter(
    (booking) => booking.payment === 'Balance due' && booking.dateISO <= TODAY,
  );
  const unconfirmedCash = cash.filter(
    (entry) => !entry.remitted && cashOlderThan(entry.confirmedOn, 24),
  );
  const windowDays = dateRange === 'Today' ? 1 : dateRange === 'Last 7 days' ? 7 : 30;
  const revenueSeries = Array.from({ length: windowDays }, (_, index) => {
    const day = new Date(`${TODAY}T12:00:00`);
    day.setDate(day.getDate() - (windowDays - 1 - index));
    const dateISO = day.toISOString().slice(0, 10);
    return {
      label: day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      value: payments
        .filter((payment) => payment.dateISO === dateISO && payment.status !== 'Failed')
        .reduce((sum, payment) => sum + payment.amount, 0),
    };
  });
  const areaCounts = new Map<string, number>();
  for (const booking of bookings) areaCounts.set(booking.area, (areaCounts.get(booking.area) ?? 0) + 1);
  const bookingsByArea = [...areaCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([area, count]) => ({ area, count }));
  const revenue = revenueSeries.reduce((sum, point) => sum + point.value, 0);
  const end = new Date(`${TODAY}T12:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - (windowDays === 1 ? 0 : windowDays - 1));
  const short = (date: Date) =>
    date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const rangeLabel = windowDays === 1 ? short(end) : `${short(start)} – ${short(end)}`;

  const cleanerFor = (booking: Booking) =>
    cleaners.find((cleaner) => cleaner.id === booking.cleanerId);

  const firstName = userName.trim().split(/\s+/)[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page">
      <section className="page-hero" aria-labelledby="overview-hero-title">
        <div>
          <p className="eyebrow">
            {todayLabel} · {rangeLabel}
          </p>
          <h1 id="overview-hero-title">
            {greeting}, {firstName}
          </h1>
          <p className="page-subtitle">
            The live picture across Kampala. Jobs, money and the queues that need a human.
          </p>
        </div>
        <div className="page-actions">
          <Button icon="reports" onClick={() => onNavigate('reports')}>
            Export report
          </Button>
          <Button variant="primary" icon="bookings" onClick={() => onNavigate('bookings')}>
            Open bookings
          </Button>
        </div>
      </section>

      <div className="kpis">
        <KpiCard
          label="Revenue"
          value={compactUgx(revenue)}
          detail={`${rangeLabel} · paid jobs`}
          icon="payments"
        />
        <KpiCard
          label="Bookings today"
          value={String(liveBookings.length)}
          detail={`${liveBookings.length} in the live queue`}
          icon="bookings"
          tone="blue"
        />
        <KpiCard
          label="Active cleaners"
          value={String(activeCleaners.length)}
          detail={`${activeCleaners.length} available · ${busyCleaners.length} on a job`}
          icon="cleaners"
          tone="yellow"
        />
        <KpiCard
          label="Average rating"
          value={averageRating}
          detail={`Across ${cleaners.length} technicians`}
          icon="spark"
          tone="rose"
        />
      </div>

      <div className="chart-grid">
        <SectionCard
          title="Revenue"
          meta={`${rangeLabel} · UGX, VAT inclusive`}
          action={<span className="legend"><i /> Collected revenue</span>}
        >
          <RevenueChart data={revenueSeries} />
        </SectionCard>
        <SectionCard title="Bookings by area" meta={`${bookings.length} jobs on record`}>
          <AreaBars data={bookingsByArea} />
          <p className="insight">
            <Icon name="spark" size={14} />
            Demand follows the areas with the most assignments this period.
          </p>
        </SectionCard>
      </div>

      <SectionCard
        title="Live bookings"
        meta="Today’s schedule, newest first"
        action={
          <button type="button" className="text-btn" onClick={() => onNavigate('bookings')}>
            View all <Icon name="chevronRight" size={14} />
          </button>
        }
      >
        <div className="table-scroll" role="region" aria-label="Live bookings" tabIndex={0}>
          <table className="table">
            <thead>
              <tr>
                <th>Booking</th>
                <th>Service</th>
                <th>Cleaner</th>
                <th>Status</th>
                <th className="align-right">Total</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {liveBookings.map((booking) => {
                const cleaner = cleanerFor(booking);
                return (
                  <tr key={booking.id}>
                    <td>
                      <div className="cell-person">
                        <Avatar name={booking.customer} tone="#E8F6EE" size="sm" />
                        <span>
                          <strong>{booking.customer}</strong>
                          <small>{booking.id} · {booking.area} · {booking.time}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="cell-main">{booking.service}</span>
                      <small className="cell-sub">{booking.hours} hours</small>
                    </td>
                    <td>
                      {cleaner ? (
                        <span className="cleaner-inline">
                          <Avatar name={cleaner.name} tone={cleaner.tone} size="sm" />
                          {cleaner.name}
                        </span>
                      ) : (
                        <span className="unassigned">Needs cleaner</span>
                      )}
                    </td>
                    <td><StatusChip label={booking.status} /></td>
                    <td className="align-right nowrap">{ugx(booking.total)}</td>
                    <td className="align-right">
                      {!booking.cleanerId ? (
                        <button
                          type="button"
                          className="text-btn"
                          onClick={() => setAssigning(booking)}
                        >
                          Assign
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="icon-btn small"
                          aria-label={`Open ${booking.id}`}
                          onClick={() => onNavigate('bookings')}
                        >
                          <Icon name="chevronRight" size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <section className="overview-queues" aria-label="Action queue">
        <SectionCard
          title="Unassigned jobs"
          meta={`${unassigned.length} need a cleaner`}
          action={<span className="rail-count">{unassigned.length}</span>}
        >
          <div className="rail-list">
            {unassigned.map((booking) => (
              <div className="rail-item" key={booking.id}>
                <div className="rail-item-top">
                  <span>
                    <strong>{booking.customer}</strong>
                    <small>{booking.id} · {booking.area}</small>
                  </span>
                  <StatusChip label={booking.status} />
                </div>
                <p>{booking.service} · {formatShortDate(booking.dateISO)}, {booking.time}</p>
                <Button
                  className="btn-small"
                  icon="cleaners"
                  onClick={() => setAssigning(booking)}
                >
                  Assign cleaner
                </Button>
              </div>
            ))}
          </div>
          <button type="button" className="card-link" onClick={() => onNavigate('bookings')}>
            Manage all bookings <Icon name="chevronRight" size={14} />
          </button>
        </SectionCard>

        <SectionCard
          title="Balances overdue"
          meta={`${overdueBalances.length} customer${overdueBalances.length === 1 ? '' : 's'}`}
          action={<span className="rail-count danger">{overdueBalances.length}</span>}
        >
          {overdueBalances.map((booking) => (
            <div className="rail-item compact" key={booking.id}>
              <div className="rail-item-top">
                <span>
                  <strong>{booking.customer}</strong>
                  <small>{booking.id} · due at service</small>
                </span>
                <strong className="money-danger">{ugx(booking.total - booking.paid)}</strong>
              </div>
              <Button
                className="btn-small"
                icon="bell"
                onClick={() => notify(`Reminder queued for ${booking.customer}.`)}
              >
                Send reminder
              </Button>
            </div>
          ))}
          {!overdueBalances.length ? <p className="rail-empty">No overdue balances.</p> : null}
        </SectionCard>

        <SectionCard
          title="Unconfirmed cash"
          meta="Older than 24 hours"
          action={<span className="rail-count danger">{unconfirmedCash.length}</span>}
        >
          {unconfirmedCash.map((entry) => (
            <div className="rail-item compact" key={entry.id}>
              <div className="rail-item-top">
                <span>
                  <strong>{entry.cleaner}</strong>
                  <small>Confirmed {formatShortDate(entry.confirmedOn)}</small>
                </span>
                <strong>{ugx(entry.amountDue)}</strong>
              </div>
              <Button
                className="btn-small"
                icon="bell"
                onClick={() => notify(`Cash reminder sent to ${entry.cleaner}.`)}
              >
                Send reminder
              </Button>
            </div>
          ))}
          <button type="button" className="card-link" onClick={() => onNavigate('cash')}>
            Open cash collections <Icon name="chevronRight" size={14} />
          </button>
        </SectionCard>
      </section>

      {assigning ? (
        <AssignCleanerDialog
          key={assigning.id}
          booking={assigning}
          cleaners={cleaners}
          onClose={() => setAssigning(null)}
          onAssign={onAssign}
        />
      ) : null}
    </div>
  );
}
