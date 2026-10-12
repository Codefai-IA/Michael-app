CREATE OR REPLACE FUNCTION public.get_member_cards(p_ids uuid[])
RETURNS TABLE (id uuid, full_name text, photo_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT p.id, p.full_name, p.photo_url
  FROM public.profiles p
  WHERE p.id = ANY (p_ids)
    AND p.access_tier IS DISTINCT FROM 'low_ticket'
    AND public.is_michael_member();
$$;

REVOKE ALL ON FUNCTION public.get_member_cards(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_member_cards(uuid[]) TO authenticated;
