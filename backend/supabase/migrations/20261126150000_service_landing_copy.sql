-- Landing copy for the customer service page (P7).
--
-- `GET /services/:slug` used to send only `slug`, `intro`, `cardImage` and
-- `heroImage`, so the app invented includes/excludes/FAQs for any service the
-- catalogue added. The desk can now write that copy per service and the API
-- returns it; the client still falls back to generic copy when these are null.

alter table public.services
  add column if not exists includes text[],
  add column if not exists excludes text[],
  add column if not exists faqs jsonb;

comment on column public.services.includes is 'What is included, one line per item';
comment on column public.services.excludes is 'What is not included, one line per item';
comment on column public.services.faqs is 'Array of {question, answer} objects';
