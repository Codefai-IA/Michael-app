CREATE OR REPLACE FUNCTION public.get_ranking(p_year_month text, p_limit int DEFAULT NULL)
RETURNS TABLE (
  id uuid, client_id uuid, year_month text, workout_points int, diet_points int, total_points int,
  days_with_workout int, days_with_diet int, updated_at timestamptz, full_name text, photo_url text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT mp.id, mp.client_id, mp.year_month, mp.workout_points, mp.diet_points, mp.total_points,
         mp.days_with_workout, mp.days_with_diet, mp.updated_at, p.full_name, p.photo_url
  FROM public.monthly_points mp
  JOIN public.profiles p ON p.id = mp.client_id
  WHERE mp.year_month = p_year_month
    AND p.access_tier IS DISTINCT FROM 'low_ticket'
    AND public.is_michael_member()
  ORDER BY mp.total_points DESC
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.get_ranking(text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_ranking(text, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_ranking(text, int) TO authenticated;
