-- Optional consented browser metadata for Snap purchase matching.
-- Nullable so historical receipts remain valid; existing RLS/grants are unchanged.
ALTER TABLE public.snap_purchase_outbox
  ADD COLUMN IF NOT EXISTS client_user_agent text
  CHECK (client_user_agent IS NULL OR length(client_user_agent) <= 1024);
