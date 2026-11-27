-- A booking's chat closes when the job is completed. The API exports the thread
-- and every message as JSONL into this private bucket, then deletes the thread
-- row (the messages cascade), so the database holds no chat for finished jobs.
--
-- The bucket is private: only the service role writes or reads it, which keeps
-- the backup out of both apps while remaining downloadable from the dashboard.

insert into storage.buckets (id, name, public)
values ('chat-archives', 'chat-archives', false)
on conflict (id) do nothing;
