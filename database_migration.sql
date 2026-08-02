-- ============================================================
-- EAWS Supabase Migration: Add Medical & Device Profile Fields
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/sswwdizgwctfwirhmroj/editor
-- ============================================================

-- 1. Add medical profile fields to the profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS blood_type       TEXT,
  ADD COLUMN IF NOT EXISTS allergies        TEXT,
  ADD COLUMN IF NOT EXISTS chronic_conditions TEXT,
  ADD COLUMN IF NOT EXISTS current_medications TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contacts  JSONB DEFAULT '[]'::jsonb;

-- 2. Add device telemetry fields (synced from mobile app)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS device_model     TEXT,
  ADD COLUMN IF NOT EXISTS device_os        TEXT,
  ADD COLUMN IF NOT EXISTS device_id        TEXT,
  ADD COLUMN IF NOT EXISTS gps_sharing      BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_battery     INTEGER,
  ADD COLUMN IF NOT EXISTS last_signal      TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at     TIMESTAMPTZ;

-- 3. Add Ghana Card and citizen ID field
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS citizen_id       TEXT,
  ADD COLUMN IF NOT EXISTS ghana_card_id    TEXT;

-- 4. Update RLS policy to allow operators to read medical fields
-- (adjust role names to match your actual roles)
CREATE POLICY IF NOT EXISTS "Operators can view citizen profiles"
  ON profiles
  FOR SELECT
  USING (
    auth.jwt() ->> 'role' IN ('dispatcher', 'police', 'fire', 'ambulance', 'admin', 'super_admin')
    OR auth.uid() = id
  );

-- 5. Add alerts table (used by Broadcast Composer → mobile app home screen)
CREATE TABLE IF NOT EXISTS alerts (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  severity     TEXT NOT NULL DEFAULT 'WARNING',
  zone_target  TEXT,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now(),
  expires_at   TIMESTAMPTZ
);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Anyone can read active alerts"
  ON alerts FOR SELECT USING (is_active = true);

CREATE POLICY IF NOT EXISTS "Operators can insert alerts"
  ON alerts FOR INSERT
  WITH CHECK (
    auth.jwt() ->> 'role' IN ('dispatcher', 'admin', 'super_admin')
  );

-- 6. Sample medical data for demo profile (D. Harrison)
-- UPDATE profiles SET
--   blood_type = 'O+',
--   allergies = 'Penicillin',
--   chronic_conditions = 'Asthma, Hypertension',
--   current_medications = 'Salbutamol, Amlodipine',
--   citizen_id = 'GH-ACR-8829-44',
--   emergency_contacts = '[
--     {"name": "Ama Harrison", "relation": "Spouse", "phone": "+233 20 111 2233"},
--     {"name": "Kwame Harrison", "relation": "Brother", "phone": "+233 24 555 7788"}
--   ]'::jsonb
-- WHERE full_name ILIKE '%harrison%';
