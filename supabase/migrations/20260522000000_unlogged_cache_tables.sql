-- Reduce WAL by converting cache tables to UNLOGGED.
--
-- These tables are pure API caches that can be rebuilt from SGU at any time.
-- UNLOGGED tables skip WAL writes entirely, which dramatically reduces I/O
-- during bulk syncs (e.g. upserting 820k wells or 1M lager rows).
--
-- Trade-off: data in these tables is truncated on server crash / failover,
-- but sync_status rows ('pending') will trigger a rebuild on next startup.
--
-- Note: Supabase Realtime cannot replicate UNLOGGED tables. These tables
-- only have public SELECT policies, so realtime is not used here.

ALTER TABLE public.wells_cache    SET UNLOGGED;
ALTER TABLE public.well_lager     SET UNLOGGED;
ALTER TABLE public.obs_nivaer     SET UNLOGGED;
ALTER TABLE public.obs_stationer  SET UNLOGGED;
ALTER TABLE public.hype_nivaer    SET UNLOGGED;

-- Remove unused indexes flagged by Supabase performance advisor.
-- Fewer indexes = less WAL per INSERT/UPDATE/DELETE/UPSERT.
DROP INDEX IF EXISTS public.idx_wells_cache_brunnsid;
DROP INDEX IF EXISTS public.idx_obs_nivaer_st_datum;
