import { useState, type FormEvent } from 'react';
import { signIn, type AdminUser } from '../lib/auth';
import { Button, Field } from './ui';

/** P27g sign-in. Supabase Auth; the console role comes from the staff profile. */
export function Login({ onSignedIn }: { onSignedIn: (user: AdminUser) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const result = await signIn(email, password);
    setBusy(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    onSignedIn(result.user);
  };

  const useAccount = (nextEmail: string, nextPassword: string) => {
    setEmail(nextEmail);
    setPassword(nextPassword);
    setError(null);
  };

  return (
    <div className="auth-shell">
      <div className="auth-brand" aria-hidden="true">
        <span className="brand-mark">G</span>
        <span className="brand-copy">
          <strong>Gabfix</strong>
          <span>Operations</span>
        </span>
      </div>

      <section className="auth-card" aria-labelledby="signin-title">
        <header className="auth-head">
          <span className="auth-eyebrow">Staff access</span>
          <h1 id="signin-title">Sign in</h1>
          <p>Manage bookings, payouts and the catalogue from one workspace.</p>
        </header>

        <form className="auth-form" onSubmit={submit}>
          <Field label="Work email" htmlFor="admin-email">
            <input
              id="admin-email"
              className="text-input"
              type="email"
              autoComplete="username"
              inputMode="email"
              placeholder="you@gabfix.ug"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Field>
          <Field label="Password" htmlFor="admin-password">
            <input
              id="admin-password"
              className="text-input"
              type="password"
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Field>

          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <div className="auth-demo">
          <strong>Seeded desk accounts</strong>
          <button type="button" onClick={() => useAccount('admin@gabfix.ug', 'gabfix2026')}>
            Owner · admin@gabfix.ug
          </button>
          <button type="button" onClick={() => useAccount('manager@gabfix.ug', 'gabfix2026')}>
            Manager · manager@gabfix.ug
          </button>
          <button type="button" onClick={() => useAccount('desk@gabfix.ug', 'gabfix2026')}>
            Customer support · desk@gabfix.ug
          </button>
          <span>Local seed passwords only; production accounts come from staff invites.</span>
        </div>
      </section>
    </div>
  );
}
