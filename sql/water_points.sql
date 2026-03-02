-- =============================================
-- Add water points to gamification system
-- =============================================

-- 1. Allow 'water_day' in points_log action_type
ALTER TABLE points_log DROP CONSTRAINT IF EXISTS points_log_action_type_check;
ALTER TABLE points_log ADD CONSTRAINT points_log_action_type_check
  CHECK (action_type IN ('workout_day', 'diet_day', 'water_day'));

-- 2. Add water columns to monthly_points
ALTER TABLE monthly_points ADD COLUMN IF NOT EXISTS water_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE monthly_points ADD COLUMN IF NOT EXISTS days_with_water INTEGER NOT NULL DEFAULT 0;

-- 3. Update total_points generated column to include water_points
ALTER TABLE monthly_points DROP COLUMN total_points;
ALTER TABLE monthly_points ADD COLUMN total_points INTEGER GENERATED ALWAYS AS (workout_points + diet_points + water_points) STORED;

-- 4. Update RPC function to accept water points
CREATE OR REPLACE FUNCTION increment_monthly_points(
  p_client_id UUID,
  p_year_month TEXT,
  p_workout_points INTEGER DEFAULT 0,
  p_diet_points INTEGER DEFAULT 0,
  p_water_points INTEGER DEFAULT 0
) RETURNS void AS $$
BEGIN
  INSERT INTO monthly_points (client_id, year_month, workout_points, diet_points, water_points, days_with_workout, days_with_diet, days_with_water)
  VALUES (
    p_client_id,
    p_year_month,
    p_workout_points,
    p_diet_points,
    p_water_points,
    CASE WHEN p_workout_points > 0 THEN 1 ELSE 0 END,
    CASE WHEN p_diet_points > 0 THEN 1 ELSE 0 END,
    CASE WHEN p_water_points > 0 THEN 1 ELSE 0 END
  )
  ON CONFLICT (client_id, year_month)
  DO UPDATE SET
    workout_points = monthly_points.workout_points + EXCLUDED.workout_points,
    diet_points = monthly_points.diet_points + EXCLUDED.diet_points,
    water_points = monthly_points.water_points + EXCLUDED.water_points,
    days_with_workout = monthly_points.days_with_workout + CASE WHEN EXCLUDED.workout_points > 0 THEN 1 ELSE 0 END,
    days_with_diet = monthly_points.days_with_diet + CASE WHEN EXCLUDED.diet_points > 0 THEN 1 ELSE 0 END,
    days_with_water = monthly_points.days_with_water + CASE WHEN EXCLUDED.water_points > 0 THEN 1 ELSE 0 END,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
