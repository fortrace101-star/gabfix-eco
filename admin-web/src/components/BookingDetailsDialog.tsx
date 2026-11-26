import { useState } from 'react';
import { formatDate, formatShortDate, ugx } from '../lib/format';
import type { Booking, Cleaner } from '../types';
import { Icon } from './Icon';
import { Avatar, Button, Modal, StatusChip } from './ui';

const inspectionStatusLabels: Record<string, string> = {
  required: 'needs scheduling',
  scheduled: 'booked',
  in_progress: 'in progress',
  submitted: 'report in',
};

/**
 * Everything about one booking that does not fit in a table row: the customer,
 * the job brief the customer filled in, the crew and the money, plus the cleaner
 * assignment. Rows in `Bookings` open this dialog.
 */
export function BookingDetailsDialog({
  booking,
  cleaners,
  onClose,
  onAssign,
  onOpenPayments,
}: {
  booking: Booking;
  cleaners: Cleaner[];
  onClose: () => void;
  onAssign: (bookingId: string, cleanerId: string) => void;
  onOpenPayments: (booking: Booking) => void;
}) {
  const [selected, setSelected] = useState(booking.cleanerId ?? '');
  const cleaner = cleaners.find((item) => item.id === booking.cleanerId);
  const support = (booking.crew ?? []).filter(
    (member) => member.role === 'Support' && member.id !== booking.cleanerId,
  );
  const balance = Math.max(booking.total - booking.paid, 0);
  const changed = selected !== (booking.cleanerId ?? '');
  const installments = booking.installments ?? [];

  return (
    <Modal
      open
      wide
      title={`${booking.customer} · ${booking.id}`}
      description={`${booking.service} · ${booking.area} · ${formatDate(booking.dateISO)}, ${booking.time}`}
      onClose={onClose}
      footer={
        <>
          <Button icon="payments" onClick={() => onOpenPayments(booking)}>
            Payments
          </Button>
          <Button onClick={onClose}>Close</Button>
          <Button
            variant="primary"
            icon="check"
            disabled={!selected || !changed}
            onClick={() => {
              onAssign(booking.id, selected);
              onClose();
            }}
          >
            {cleaner ? 'Reassign cleaner' : 'Assign cleaner'}
          </Button>
        </>
      }
    >
      <div className="booking-detail-grid">
        <div className="detail-item">
          <span className="detail-label">Customer</span>
          <span className="detail-value">{booking.customer}</span>
          <small className="cell-sub">{booking.phone || 'No phone on file'}</small>
        </div>
        <div className="detail-item">
          <span className="detail-label">Service</span>
          <span className="detail-value">{booking.service}</span>
          <small className="cell-sub">{booking.hours} hours</small>
        </div>
        <div className="detail-item">
          <span className="detail-label">Date & time</span>
          <span className="detail-value">{formatShortDate(booking.dateISO)}</span>
          <small className="cell-sub">{booking.time}</small>
        </div>
        <div className="detail-item">
          <span className="detail-label">Status</span>
          <span className="detail-value">
            <StatusChip label={booking.status} /> <StatusChip label={booking.payment} />
          </span>
          {booking.inspection ? (
            <small className="cell-sub">
              Inspection {inspectionStatusLabels[booking.inspection.status] ?? booking.inspection.status}
              {booking.inspection.scheduledAt
                ? ` · ${formatShortDate(booking.inspection.scheduledAt.slice(0, 10))}`
                : ''}
            </small>
          ) : null}
        </div>
      </div>

      <div className="payment-summary">
        <div>
          <span>Total</span>
          <strong>{ugx(booking.total)}</strong>
        </div>
        <div>
          <span>Paid</span>
          <strong className="money-paid">{ugx(booking.paid)}</strong>
        </div>
        <div>
          <span>Balance</span>
          <strong className="money-danger">{ugx(balance)}</strong>
        </div>
      </div>

      {installments.length ? (
        <div className="installment-list detail-installments">
          {installments.map((installment, index) => (
            <small key={installment.id} className="cell-sub installment-row">
              <span>
                {installment.kind === 'Deposit' ? `Deposit ${index + 1}` : installment.kind}
                {' · '}{installment.method}
              </span>
              <strong>{ugx(installment.amount)}</strong>
            </small>
          ))}
        </div>
      ) : null}

      {booking.scope ? (
        <div className="detail-section">
          <strong className="detail-section-title">Job scope</strong>
          <span className="detail-value">{booking.scope.summary}</span>
          {booking.scope.facts?.length ? (
            <div className="detail-facts">
              {booking.scope.facts.map((fact) => (
                <span key={fact.label} className="cell-sub">
                  <strong>{fact.label}:</strong> {fact.value}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {booking.media?.length ? (
        <div className="detail-section">
          <strong className="detail-section-title">
            <Icon name="camera" size={14} /> Media ({booking.media.length})
          </strong>
          <div className="detail-media">
            {booking.media.map((item) => (
              <span key={item.id} className="detail-media-item" title={item.label ?? item.kind}>
                <Icon name={item.kind === 'video' ? 'camera' : 'image'} size={16} />
                {item.kind === 'video' && item.durationSec ? `${item.durationSec}s` : item.kind}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="detail-section">
        <strong className="detail-section-title">
          Cleaner
          {cleaner ? (
            <span className="detail-crew">
              <Avatar name={cleaner.name} tone={cleaner.tone} size="sm" /> {cleaner.name}
              {support.length ? ` + ${support.map((member) => member.name).join(', ')}` : ''}
            </span>
          ) : (
            <span className="unassigned">Needs cleaner</span>
          )}
        </strong>
        <div className="cleaner-picker" role="radiogroup" aria-label="Available cleaners">
          {cleaners.map((option) => (
            <button
              type="button"
              role="radio"
              aria-checked={selected === option.id}
              key={option.id}
              className={`cleaner-option${selected === option.id ? ' selected' : ''}`}
              onClick={() => setSelected(option.id)}
              disabled={!option.available && booking.cleanerId !== option.id}
            >
              <Avatar name={option.name} tone={option.tone} />
              <span className="cleaner-option-main">
                <strong>{option.name}</strong>
                <span>
                  {option.area} · {option.rating.toFixed(1)} rating
                </span>
              </span>
              <StatusChip label={option.available ? 'Available' : 'Unavailable'} />
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
