CREATE TABLE IF NOT EXISTS wells_cache (
  obsplatsid            TEXT PRIMARY KEY,
  omradesnamn           TEXT,
  lan                   TEXT,
  kommunnamn            TEXT,
  jordart               TEXT,
  bergart               TEXT,
  senaste_nivamaetning  TEXT,
  latitude              REAL,
  longitude             REAL,
  borrdjup              REAL,
  rordjup               REAL,
  hammarniva            REAL,
  referensniva          REAL
);
CREATE INDEX IF NOT EXISTS idx_wells_lon ON wells_cache (longitude);
CREATE INDEX IF NOT EXISTS idx_wells_lat ON wells_cache (latitude);

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

CREATE TABLE IF NOT EXISTS obs_nivaer (
  obsplatsid          TEXT NOT NULL,
  obsdatum            TEXT NOT NULL,
  nivaer_m_u_markyta  REAL,
  nivaer_m_o_h        REAL,
  PRIMARY KEY (obsplatsid, obsdatum)
);
CREATE INDEX IF NOT EXISTS idx_obs_nivaer_obsplatsid ON obs_nivaer (obsplatsid);

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
