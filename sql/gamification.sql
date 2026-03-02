-- =============================================
-- Gamification: Monthly Points & Ranking System
-- =============================================

-- 1. Monthly points table (one row per user per month)
CREATE TABLE monthly_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,
  workout_points INTEGER NOT NULL DEFAULT 0,
  diet_points INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER GENERATED ALWAYS AS (workout_points + diet_points) STORED,
  days_with_workout INTEGER NOT NULL DEFAULT 0,
  days_with_diet INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, year_month)
);

CREATE INDEX idx_monthly_points_ranking ON monthly_points(year_month, total_points DESC);
CREATE INDEX idx_monthly_points_client ON monthly_points(client_id, year_month);

-- 2. Points log (audit trail, prevents duplicate awards)
CREATE TABLE points_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('workout_day', 'diet_day')),
  points INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, date, action_type)
);

CREATE INDEX idx_points_log_client_date ON points_log(client_id, date);

-- 3. RLS Policies

-- monthly_points: everyone can READ (global ranking), users can INSERT/UPDATE own rows
ALTER TABLE monthly_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view ranking"
  ON monthly_points FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own points"
  ON monthly_points FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "Users can update own points"
  ON monthly_points FOR UPDATE
  TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- points_log: users can read and insert own rows only
ALTER TABLE points_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own points log"
  ON points_log FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "Users can insert own points log"
  ON points_log FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid());

-- 4. RPC function for atomic point increment (SECURITY DEFINER bypasses RLS for upsert)
CREATE OR REPLACE FUNCTION increment_monthly_points(
  p_client_id UUID,
  p_year_month TEXT,
  p_workout_points INTEGER DEFAULT 0,
  p_diet_points INTEGER DEFAULT 0
) RETURNS void AS $$
BEGIN
  INSERT INTO monthly_points (client_id, year_month, workout_points, diet_points, days_with_workout, days_with_diet)
  VALUES (
    p_client_id,
    p_year_month,
    p_workout_points,
    p_diet_points,
    CASE WHEN p_workout_points > 0 THEN 1 ELSE 0 END,
    CASE WHEN p_diet_points > 0 THEN 1 ELSE 0 END
  )
  ON CONFLICT (client_id, year_month)
  DO UPDATE SET
    workout_points = monthly_points.workout_points + EXCLUDED.workout_points,
    diet_points = monthly_points.diet_points + EXCLUDED.diet_points,
    days_with_workout = monthly_points.days_with_workout + CASE WHEN EXCLUDED.workout_points > 0 THEN 1 ELSE 0 END,
    days_with_diet = monthly_points.days_with_diet + CASE WHEN EXCLUDED.diet_points > 0 THEN 1 ELSE 0 END,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Optional: Backfill existing data from daily_progress
-- Uncomment and run once to credit past activity:
--
-- INSERT INTO monthly_points (client_id, year_month, workout_points, diet_points, days_with_workout, days_with_diet)
-- SELECT
--   client_id,
--   TO_CHAR(date::date, 'YYYY-MM') as year_month,
--   COUNT(CASE WHEN array_length(exercises_completed, 1) > 0 THEN 1 END) * 10,
--   COUNT(CASE WHEN array_length(meals_completed, 1) > 0 THEN 1 END) * 10,
--   COUNT(CASE WHEN array_length(exercises_completed, 1) > 0 THEN 1 END),
--   COUNT(CASE WHEN array_length(meals_completed, 1) > 0 THEN 1 END)
-- FROM daily_progress
-- GROUP BY client_id, TO_CHAR(date::date, 'YYYY-MM')
-- ON CONFLICT (client_id, year_month) DO UPDATE SET
--   workout_points = EXCLUDED.workout_points,
--   diet_points = EXCLUDED.diet_points,
--   days_with_workout = EXCLUDED.days_with_workout,
--   days_with_diet = EXCLUDED.days_with_diet;
