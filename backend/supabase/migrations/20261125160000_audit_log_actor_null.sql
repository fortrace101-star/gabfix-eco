-- Account deletion must not be blocked by append-only audit rows.
--
-- `audit_log.actor_id` referenced `profiles` with the default NO ACTION, so deleting a
-- profile that had ever written an audit row failed. `on delete set null` is not an
-- option either: the cascade is an UPDATE on `audit_log`, which the append-only trigger
-- rejects. Keep the actor id as a plain uuid so history survives a deleted account.

alter table public.audit_log
  drop constraint audit_log_actor_id_fkey;
