-- Observation stations from SGU grundvattennivaer-observerade/stationer
CREATE TABLE public.obs_stationer (
  platsbeteckning TEXT PRIMARY KEY,
  stationsnamn    TEXT,
  jordart_tx      TEXT,
  akvifer         TEXT,
  lon             DOUBLE PRECISION NOT NULL,
  lat             DOUBLE PRECISION NOT NULL,
  cached_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_obs_stationer_coords ON public.obs_stationer (lon, lat);

ALTER TABLE public.obs_stationer ENABLE ROW LEVEL SECURITY;
CREATE POLICY "obs_stationer readable" ON public.obs_stationer FOR SELECT USING (true);

CREATE TABLE public.obs_nivaer (
  platsbeteckning TEXT    NOT NULL REFERENCES public.obs_stationer (platsbeteckning) ON DELETE CASCADE,
  obsdatum        DATE    NOT NULL,
  nivaer_m        REAL,
  cached_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (platsbeteckning, obsdatum)
);

CREATE INDEX idx_obs_nivaer_datum    ON public.obs_nivaer (obsdatum);
CREATE INDEX idx_obs_nivaer_st_datum ON public.obs_nivaer (platsbeteckning, obsdatum);

ALTER TABLE public.obs_nivaer ENABLE ROW LEVEL SECURITY;
CREATE POLICY "obs_nivaer readable" ON public.obs_nivaer FOR SELECT USING (true);

INSERT INTO public.sync_status (id, status) VALUES
  ('obs_stationer', 'pending'),
  ('obs_nivaer',    'pending');