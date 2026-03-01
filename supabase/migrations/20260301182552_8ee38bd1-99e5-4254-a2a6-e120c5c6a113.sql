
-- Table to cache wells from SGU API
CREATE TABLE public.wells_cache (
  id SERIAL PRIMARY KEY,
  brunnsid TEXT UNIQUE NOT NULL,
  obsplatsid TEXT,
  properties JSONB NOT NULL DEFAULT '{}',
  lon DOUBLE PRECISION NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Spatial index on coordinates for bbox queries
CREATE INDEX idx_wells_cache_coords ON public.wells_cache (lon, lat);
CREATE INDEX idx_wells_cache_brunnsid ON public.wells_cache (brunnsid);

-- Allow public read access (no auth required for viewing wells)
ALTER TABLE public.wells_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Wells cache is publicly readable"
  ON public.wells_cache
  FOR SELECT
  USING (true);

-- Metadata table to track sync status
CREATE TABLE public.sync_status (
  id TEXT PRIMARY KEY,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  total_records INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending'
);

ALTER TABLE public.sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sync status is publicly readable"
  ON public.sync_status
  FOR SELECT
  USING (true);

INSERT INTO public.sync_status (id, status) VALUES ('wells', 'pending');
