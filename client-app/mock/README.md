# Client mock API

Phase 1, task 1.6. A zero-dependency Node server that implements the REST contract in
`src/lib/api/` so the app can run against a real HTTP boundary without the Supabase stack.

```bash
npm run mock
# in a second terminal
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000 npx expo start --clear
```

| Route | Used by |
|---|---|
| `POST /auth/login`, `/auth/register`, `/auth/otp/request`, `/auth/otp/verify`, `/auth/refresh` | Onboarding (P2a–P2d) |
| `GET /services`, `GET /search`, `GET /services/:slug` | Home, Services, Search, P7 |
| `GET /availability?service=&date=` | P10 Schedule |
| `POST /bookings` | P12 Review and pay |
| `GET /bookings/:id`, `GET /bookings/:id/tracking` | P15b/P15c |
| `GET /health` | readiness check |

Notes:

- Data is in memory and resets when the server stops; it is a fixture, not a backend.
- `Idempotency-Key` is honoured on `POST /bookings` so a retried confirmation returns the same booking.
- OTP accepts any six digits except `000000`, which exercises P2c's error state.
- The mock sends `pricingMode: "fixed"` on `carpet-clean` so the D6 fixed-price path can be exercised without editing the bundled catalogue.
- The real contract stays owned by `backend/` and `Full_App_Architecture_2.md` D1; this server must follow the client, not the other way round.
