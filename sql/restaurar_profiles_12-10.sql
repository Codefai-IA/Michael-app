DROP FUNCTION IF EXISTS public.get_member_cards(uuid[]);

CREATE OR REPLACE FUNCTION public.can_self_create_profile()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
      AND u.created_at > now() - interval '10 minutes'
      AND coalesce(u.raw_user_meta_data->>'origem', '') <> 'escola'
  )
  AND NOT EXISTS (SELECT 1 FROM escola.members m WHERE m.user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.can_self_create_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_self_create_profile() TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
CREATE POLICY "Authenticated users can read profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_michael_member());

DROP POLICY IF EXISTS "Users create own client profile" ON public.profiles;
CREATE POLICY "Users create own client profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid() AND role = 'client' AND public.can_self_create_profile());
