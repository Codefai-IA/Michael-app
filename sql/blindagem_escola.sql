-- BLINDAGEM DO APP MICHAEL (Escola do Nutri usa o mesmo Supabase)
-- Rodar ANTES de existir o primeiro aluno da Escola.
-- Regra: dado de aluno do Michael so e lido por quem tem linha em profiles.

CREATE OR REPLACE FUNCTION public.is_michael_member()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.is_michael_member() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_michael_member() TO authenticated;

-- Fotos de check-in: antes USING (true)
DROP POLICY IF EXISTS "Authenticated can view all checkin photos" ON public.checkin_photos;
CREATE POLICY "Authenticated can view all checkin photos"
  ON public.checkin_photos FOR SELECT
  TO authenticated
  USING (public.is_michael_member());

-- Ranking: antes USING (true)
DROP POLICY IF EXISTS "Anyone authenticated can view ranking" ON public.monthly_points;
CREATE POLICY "Anyone authenticated can view ranking"
  ON public.monthly_points FOR SELECT
  TO authenticated
  USING (public.is_michael_member());

-- Receitas do app Michael: antes USING (true)
DROP POLICY IF EXISTS "Authenticated can view recipes" ON public.recipes;
CREATE POLICY "Authenticated can view recipes"
  ON public.recipes FOR SELECT
  TO authenticated
  USING (public.is_michael_member());

-- Calendario de terceiros: mesma consulta, so para quem e aluno/admin do Michael
CREATE OR REPLACE FUNCTION public.get_user_calendar(p_client_id UUID, p_year_month TEXT)
RETURNS TABLE (
  date DATE,
  has_diet BOOLEAN,
  has_workout BOOLEAN,
  activity_types TEXT[],
  photos JSONB
) AS $$
  SELECT
    days.date,
    COALESCE(array_length(dp.meals_completed, 1) > 0, false)      AS has_diet,
    COALESCE(array_length(dp.exercises_completed, 1) > 0, false)  AS has_workout,
    COALESCE(
      array_agg(DISTINCT ph.activity_type)
        FILTER (WHERE ph.activity_type IS NOT NULL),
      '{}'
    ) AS activity_types,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', ph.id,
          'type', ph.type,
          'taken_at', ph.taken_at,
          'storage_path', ph.storage_path,
          'meal_id', ph.meal_id,
          'activity_type', ph.activity_type
        ) ORDER BY ph.taken_at
      ) FILTER (WHERE ph.id IS NOT NULL),
      '[]'::jsonb
    ) AS photos
  FROM (
    SELECT DISTINCT d AS date FROM (
      SELECT date AS d FROM daily_progress
        WHERE client_id = p_client_id AND to_char(date, 'YYYY-MM') = p_year_month
      UNION
      SELECT date AS d FROM checkin_photos
        WHERE client_id = p_client_id AND to_char(date, 'YYYY-MM') = p_year_month
    ) u
  ) days
  LEFT JOIN daily_progress dp
    ON dp.client_id = p_client_id AND dp.date = days.date
  LEFT JOIN checkin_photos ph
    ON ph.client_id = p_client_id AND ph.date = days.date
  WHERE auth.uid() IS NULL OR public.is_michael_member()
  GROUP BY days.date, dp.meals_completed, dp.exercises_completed
  ORDER BY days.date;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.has_diet_photo(p_client_id UUID, p_date DATE)
RETURNS BOOLEAN AS $$
  SELECT (auth.uid() IS NULL OR public.is_michael_member()) AND EXISTS (
    SELECT 1 FROM checkin_photos
    WHERE client_id = p_client_id AND date = p_date AND type = 'diet'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
