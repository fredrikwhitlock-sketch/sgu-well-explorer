-- On-demand cache for SGU-HYPE groundwater fill degree per catchment area
CREATE TABLE public.hype_nivaer (
  omrade_id                  INTEGER  NOT NULL,
  datum                      DATE     NOT NULL,
  fyllnadsgrad_sma           REAL,
  fyllnadsgrad_stora         REAL,
  grundvattensituation_sma   SMALLINT,
  grundvattensituation_stora SMALLINT,
  cached_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (omrade_id, datum)
);

CREATE INDEX idx_hype_nivaer_omrade ON public.hype_nivaer (omrade_id);

ALTER TABLE public.hype_nivaer ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hype_nivaer readable" ON public.hype_nivaer FOR SELECT USING (true);

INSERT INTO public.sync_status (id, status) VALUES ('hype_nivaer', 'pending') ON CONFLICT DO NOTHING;
