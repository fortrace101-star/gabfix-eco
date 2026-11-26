import { useState } from 'react';
import type { Booking, Cleaner } from '../types';
import { Icon } from './Icon';
import { Avatar, Button, Drawer, StatusChip } from './ui';

export function AssignCleanerDialog({
  booking,
  cleaners,
  onClose,
  onAssign,
}: {
  booking: Booking;
  cleaners: Cleaner[];
  onClose: () => void;
  onAssign: (bookingId: string, cleanerId: string) => void;
}) {
  const [selected, setSelected] = useState(booking.cleanerId ?? '');

  return (
    <Drawer
      open
      title="Assign a cleaner"
      description={`${booking.id} · ${booking.service} · ${booking.area} · ${booking.time}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            icon="check"
            disabled={!selected}
            onClick={() => {
              onAssign(booking.id, selected);
              onClose();
            }}
          >
            Assign cleaner
          </Button>
        </>
      }
    >
      {booking.scope || booking.media?.length ? (
        <div className="booking-scope-block">
          {booking.scope ? (
            <div className="scope-facts">
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
            <div className="scope-media">
              <strong className="detail-section-title">
                <Icon name="camera" size={16} /> Media ({booking.media.length})
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
        </div>
      ) : null}

      <div className="cleaner-picker" role="radiogroup" aria-label="Available cleaners">
        {cleaners.map((cleaner) => (
          <button
            type="button"
            role="radio"
            aria-checked={selected === cleaner.id}
            key={cleaner.id}
            className={`cleaner-option${selected === cleaner.id ? ' selected' : ''}`}
            onClick={() => setSelected(cleaner.id)}
            disabled={!cleaner.available && booking.cleanerId !== cleaner.id}
          >
            <Avatar name={cleaner.name} tone={cleaner.tone} />
            <span className="cleaner-option-main">
              <strong>{cleaner.name}</strong>
              <span>
                {cleaner.area} · {cleaner.rating.toFixed(1)} rating
              </span>
            </span>
            <StatusChip label={cleaner.available ? 'Available' : 'Unavailable'} />
          </button>
        ))}
      </div>
    </Drawer>
  );
}
