-- Match Supabase wells_cache schema so MapView code works unchanged
CREATE TABLE IF NOT EXISTS wells_cache (
  brunnsid    TEXT PRIMARY KEY,
  obsplatsid  TEXT,
  lon         REAL NOT NULL,
  lat         REAL NOT NULL,
  properties  TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_wells_lon ON wells_cache (lon);
CREATE INDEX IF NOT EXISTS idx_wells_lat ON wells_cache (lat);

CREATE TABLE IF NOT EXISTS well_lager (
  lagerid          TEXT PRIMARY KEY,
  obsplatsid       TEXT NOT NULL,
  lagernr          INTEGER NOT NULL,
  djup_fran        REAL,
  djup_till        REAL,
  jordart_bergart  TEXT,
  lageranmarkning  TEXT
);
CREATE INDEX IF NOT EXISTS idx_well_lager_obsplatsid ON well_lager (obsplatsid);

-- Match Supabase obs_nivaer schema (platsbeteckning + nivaer_m)
CREATE TABLE IF NOT EXISTS obs_nivaer (
  platsbeteckning  TEXT NOT NULL,
  obsdatum         TEXT NOT NULL,
  nivaer_m         REAL,
  PRIMARY KEY (platsbeteckning, obsdatum)
);
CREATE INDEX IF NOT EXISTS idx_obs_nivaer_plats ON obs_nivaer (platsbeteckning);

CREATE TABLE IF NOT EXISTS hype_nivaer (
  omrade_id                  INTEGER NOT NULL,
  datum                      TEXT NOT NULL,
  fyllnadsgrad_sma           REAL,
  fyllnadsgrad_stora         REAL,
  grundvattensituation_sma   INTEGER,
  grundvattensituation_stora INTEGER,
  PRIMARY KEY (omrade_id, datum)
);
CREATE INDEX IF NOT EXISTS idx_hype_nivaer_omrade ON hype_nivaer (omrade_id);
