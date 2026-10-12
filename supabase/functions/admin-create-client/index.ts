import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Cria aluno pelo painel (AddClientModal): conta no Auth + profile, com service role.
 *
 * Substitui o supabase.auth.signUp no navegador, que exigia o cadastro publico ligado e deixava
 * o proprio aluno novo gravar o profile. So admin chama (mesma checagem do send-push).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Campos do profile que o modal manda; o resto (role, is_active, access_tier) e decidido aqui.
const PROFILE_FIELDS = [
  'full_name', 'phone', 'birth_date', 'age', 'height_cm', 'current_weight_kg', 'starting_weight_kg',
  'goal_weight_kg', 'goals', 'coaching_start_date', 'locale', 'unit_system',
] as const;

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: caller } = token ? await supabaseAdmin.auth.getUser(token) : { data: { user: null } };
    if (!caller.user) return json(401, { error: 'unauthorized' });
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', caller.user.id)
      .maybeSingle();
    if (callerProfile?.role?.toLowerCase() !== 'admin') return json(403, { error: 'forbidden' });

    const body = await req.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
    if (!fullName) return json(400, { error: 'Nome completo é obrigatório' });
    if (!EMAIL_RE.test(email)) return json(400, { error: 'Email inválido' });
    if (password.length < 8) return json(400, { error: 'Senha deve ter pelo menos 8 caracteres' });

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (createError || !created.user) {
      const msg = createError?.message ?? '';
      if (/already|registered|exists/i.test(msg)) return json(409, { error: 'Este email já está cadastrado' });
      return json(500, { error: msg || 'Erro ao criar usuário' });
    }

    const profile: Record<string, unknown> = {};
    for (const field of PROFILE_FIELDS) {
      if (field in body) profile[field] = body[field];
    }
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert(
      { ...profile, id: created.user.id, email, full_name: fullName, role: 'client', is_active: true },
      { onConflict: 'id' }
    );
    if (profileError) {
      // Sem profile o login nao serve para nada: desfaz a conta para o admin poder tentar de novo.
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      return json(500, { error: 'Erro ao salvar perfil: ' + profileError.message });
    }

    return json(200, { id: created.user.id });
  } catch (err) {
    console.error('admin-create-client error:', err);
    return json(500, { error: 'Erro inesperado ao criar cliente' });
  }
});
