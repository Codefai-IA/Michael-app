DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
CREATE POLICY "Authenticated users can read profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users create own client profile" ON public.profiles;
DROP FUNCTION IF EXISTS public.can_self_create_profile();
REVOKE ALL ON FUNCTION public.get_member_cards(uuid[]) FROM anon;
