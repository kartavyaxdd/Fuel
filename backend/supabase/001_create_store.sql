-- Fuel nutrition app — Supabase schema
-- Run this in the Supabase SQL Editor after creating a project.

-- The store table replaces the JSON-file persistence layer.
-- Each row holds one domain's snapshot (foodLog, weight, goal).
CREATE TABLE IF NOT EXISTS store (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Permit the anon key to read/write (single-user demo app).
ALTER TABLE store ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON store
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
