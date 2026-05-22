-- Track when a sync session begins (separate from last_synced_at which marks completion)
ALTER TABLE public.sync_status ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- Enable Supabase Realtime so the dashboard gets live push updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_status;
