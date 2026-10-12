-- Diagnostico SO LEITURA antes da blindagem (Escola do Nutri divide este Supabase).
-- 1. Triggers em auth.users (se aparecer algum que cria profiles, avisar)
SELECT tgname, pg_get_triggerdef(t.oid) AS def
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'auth' AND c.relname = 'users' AND NOT t.tgisinternal;

-- 2. Usuarios do Auth sem profile (hoje vem todos ao app vazio)
SELECT u.id, u.email, u.created_at, u.last_sign_in_at
FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL ORDER BY u.created_at DESC;

-- 3. Policies de leitura que liberam para qualquer usuario logado
SELECT schemaname, tablename, policyname, roles, cmd, qual
FROM pg_policies
WHERE schemaname IN ('public', 'storage') AND cmd IN ('SELECT', 'ALL')
ORDER BY tablename, policyname;

-- 4. Funcoes SECURITY DEFINER liberadas para authenticated no schema public
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef
  AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
ORDER BY 1;
