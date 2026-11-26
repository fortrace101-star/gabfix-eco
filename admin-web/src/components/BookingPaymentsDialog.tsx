import { downloadCsv, formatDate, ugx } from '../lib/format';
import type { Booking, BookingInstallment } from '../types';
import { Button, Drawer, StatusChip } from './ui';

/** One CSV per payment: the desk's copy of what the customer paid. */
const downloadReceipt = (booking: Booking, payment: BookingInstallment): void => {
  const balance = Math.max(booking.total - booking.paid, 0);
  downloadCsv(`gabfix-receipt-${booking.id}-${payment.id.slice(0, 8)}.csv`, [
    ['Receipt', payment.id],
    ['Booking', booking.id],
    ['Customer', booking.customer],
    ['Phone', booking.phone],
    ['Service', booking.service],
    ['Instalment', payment.kind],
    ['Method', payment.method],
    ['Status', payment.status],
    ['Date', payment.dateISO],
    ['Amount UGX', payment.amount],
    ['Booking total UGX', booking.total],
    ['Paid to date UGX', booking.paid],
    ['Balance UGX', balance],
  ]);
};

export function BookingPaymentsDialog({
  booking,
  onClose,
}: {
  booking: Booking;
  onClose: () => void;
}) {
  const history = booking.paymentHistory ?? [];
  const balance = Math.max(booking.total - booking.paid, 0);

  return (
    <Drawer
      open
      wide
      title={`${booking.id} · payments`}
      description={`${booking.customer} · ${booking.service} · ${formatDate(booking.dateISO)}, ${booking.time}`}
      onClose={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
    >
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

      {history.length ? (
        <div className="table-scroll" role="region" aria-label="Payment history" tabIndex={0}>
          <table className="table compact-table">
            <thead>
              <tr>
                <th>Instalment</th>
                <th>Method</th>
                <th>Date</th>
                <th>Status</th>
                <th className="align-right">Amount</th>
                <th aria-label="Receipt" />
              </tr>
            </thead>
            <tbody>
              {history.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.kind}</td>
                  <td>{payment.method}</td>
                  <td className="nowrap">{formatDate(payment.dateISO)}</td>
                  <td><StatusChip label={payment.status} /></td>
                  <td className="align-right nowrap">{ugx(payment.amount)}</td>
                  <td className="align-right">
                    <Button
                      className="btn-small"
                      icon="download"
                      onClick={() => downloadReceipt(booking, payment)}
                    >
                      Receipt
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="payment-empty">
          No payments recorded for this booking. Nothing has been collected against it yet.
        </p>
      )}
    </Drawer>
  );
}
