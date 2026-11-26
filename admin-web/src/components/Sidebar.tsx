import { canViewPage, roleLabel, type AdminRole, type AdminUser } from '../lib/auth';
import { cx } from '../lib/format';
import type { LiveStatus } from '../lib/live';
import type { PageId } from '../types';
import { Icon, type IconName } from './Icon';

type NavItem = { id: PageId; label: string; icon: IconName };

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Workspace',
    items: [
      { id: 'overview', label: 'Overview', icon: 'overview' },
      { id: 'bookings', label: 'Bookings', icon: 'bookings' },
      { id: 'approvals', label: 'Approvals', icon: 'check' },
      { id: 'quotes', label: 'Quotes & inspections', icon: 'spark' },
      { id: 'support', label: 'Support', icon: 'messages' },
      { id: 'payments', label: 'Payments', icon: 'payments' },
      { id: 'cash', label: 'Cash collections', icon: 'cash' },
    ],
  },
  {
    label: 'People',
    items: [
      { id: 'customers', label: 'Customers', icon: 'customers' },
      { id: 'cleaners', label: 'Cleaners', icon: 'cleaners' },
    ],
  },
  {
    label: 'Catalogue',
    items: [
      { id: 'catalogue', label: 'Catalogue', icon: 'services' },
      { id: 'services', label: 'Services & pricing', icon: 'payments' },
      { id: 'forms', label: 'Booking forms', icon: 'bookings' },
      { id: 'promos', label: 'Promos', icon: 'promos' },
    ],
  },
  {
    label: 'Business',
    items: [
      { id: 'costs', label: 'Job costs', icon: 'payments' },
      { id: 'reports', label: 'Reports', icon: 'reports' },
      { id: 'settings', label: 'Settings', icon: 'settings' },
    ],
  },
];

const liveCopy: Record<LiveStatus, { label: string; detail: string }> = {
  live: { label: 'Realtime connected', detail: 'Syncs automatically' },
  connecting: { label: 'Connecting', detail: 'Checking the feed' },
  offline: { label: 'Manual refresh', detail: 'Realtime unavailable' },
};

export function Sidebar({
  active,
  onNavigate,
  user,
  role,
  cashDue,
  live,
}: {
  active: PageId;
  onNavigate: (page: PageId) => void;
  user: AdminUser;
  role: AdminRole;
  /** Open cash collections, shown as the nav badge. */
  cashDue: number;
  live: LiveStatus;
}) {
  const status = liveCopy[live];

  return (
    <aside className="sidebar" aria-label="Operations navigation">
      <div className="brand-row">
        <span className="brand-mark" aria-hidden="true">
          G
        </span>
        <span className="brand-copy">
          <strong>Gabfix</strong>
          <span>Operations</span>
        </span>
      </div>

      <nav className="nav">
        {groups.map((group) => {
          const items = group.items.filter((item) => canViewPage(item.id, role));
          if (items.length === 0) return null;
          return (
            <div className="nav-group" key={group.label}>
              <p className="nav-label">{group.label}</p>
              {items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={cx('nav-item', active === item.id && 'active')}
                  aria-current={active === item.id ? 'page' : undefined}
                  title={item.label}
                  onClick={() => onNavigate(item.id)}
                >
                  <Icon name={item.icon} size={20} />
                  <span>{item.label}</span>
                  {item.id === 'cash' && cashDue > 0 ? (
                    <em className="nav-badge">{cashDue}</em>
                  ) : null}
                </button>
              ))}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-user">
        <span className="sidebar-avatar" aria-hidden="true">
          {user.initials}
        </span>
        <span className="sidebar-user-copy">
          <strong>{user.name}</strong>
          <span>{roleLabel(role)}</span>
        </span>
      </div>

      <div className="sidebar-foot">
        <span className={cx('status-dot', live)} />
        <span className="sidebar-foot-copy">
          <strong>{status.label}</strong>
          <span>{status.detail}</span>
        </span>
      </div>
    </aside>
  );
}
