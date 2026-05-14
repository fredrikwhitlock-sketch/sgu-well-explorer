-- Borehole layer sequences from SGU brunnar/brunnar-lager
CREATE TABLE public.well_lager (
  lagerid          TEXT PRIMARY KEY,
  obsplatsid       TEXT NOT NULL,
  lagernr          INTEGER NOT NULL,
  djup_fran        REAL,
  djup_till        REAL,
  jordart_bergart  TEXT,
  lageranmarkning  TEXT,
  cached_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_well_lager_obsplatsid ON public.well_lager (obsplatsid);

ALTER TABLE public.well_lager ENABLE ROW LEVEL SECURITY;
CREATE POLICY "well_lager readable" ON public.well_lager FOR SELECT USING (true);

INSERT INTO public.sync_status (id, status) VALUES ('well_lager', 'pending');
