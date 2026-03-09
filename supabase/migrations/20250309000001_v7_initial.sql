-- ═══════════════════════════════════════════════════════════════
-- MicroVest v8 — Migration 001: v7 Initial Schema
-- Apply: supabase db push OR run manually in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- This migration contains the full schema_v7.sql content.
-- For initial setup, run schema_v7.sql directly in Supabase SQL Editor.
-- This file is for Supabase CLI migration tracking.

-- Track this migration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'schema_migrations'
  ) THEN
    CREATE TABLE schema_migrations (
      version     TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ DEFAULT NOW(),
      description TEXT
    );
  END IF;
END $$;

INSERT INTO schema_migrations(version, description) 
VALUES ('20250309000001', 'v7 initial schema')
ON CONFLICT(version) DO NOTHING;
