-- Blindagem da tabela profiles (12/10/2026). Pode rodar mais de uma vez.
-- Antes: a policy "Enable all for authenticated users on profiles" deixava QUALQUER usuario logado
-- criar, alterar e apagar QUALQUER perfil (inclusive virar admin), e o aluno podia trocar o proprio role.

-- Cadastro do proprio perfil so logo depois de criar a conta (AddClientModal faz signUp + upsert)
-- e nunca para usuario da Escola do Nutri.
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

DROP POLICY IF EXISTS "Enable all for authenticated users on profiles" ON public.profiles;

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

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Campos que so o admin muda (access_tier ja e protegido por trg_protect_access_tier).
CREATE OR REPLACE FUNCTION public.protect_profile_admin_fields()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    NEW.role := OLD.role;
    NEW.is_active := OLD.is_active;
    NEW.email := OLD.email;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_admin_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_admin_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_admin_fields();
