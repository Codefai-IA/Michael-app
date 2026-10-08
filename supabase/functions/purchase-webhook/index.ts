import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Webhook do gateway de pagamento do funil low ticket.
 *
 * Compra aprovada -> cria o aluno (convite por e-mail para ele definir a senha), marca como
 * access_tier = 'low_ticket' e copia o template de treino do produto (purchase_products).
 * Reembolso/chargeback -> vence o plano (plan_end_date = ontem), caindo na tela de plano expirado.
 *
 * So mexe em aluno CRIADO por aqui: quem ja e aluno 'full' nunca e rebaixado nem expirado.
 *
 * Deploy: supabase functions deploy purchase-webhook --no-verify-jwt
 * Secrets: WEBHOOK_SECRET (obrigatorio), APP_URL (ex: https://app.dominio.com, opcional)
 */

type PurchaseEvent = 'approved' | 'refunded' | 'chargeback' | 'ignored';

interface ParsedEvent {
  gateway: string;
  event: PurchaseEvent;
  transactionId: string;
  email: string;
  name: string | null;
  phone: string | null;
  /** Ids que podem estar em purchase_products (produto e oferta; order bump traz varios). */
  productIds: string[];
}

const str = (v: unknown) =>
  typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null;

/**
 * Kirvano: { "event": "SALE_APPROVED" | "SALE_REFUNDED" | "SALE_CHARGEBACK" | ..., "sale_id",
 *   "customer": { "name", "email", "phone_number" }, "products": [{ "id", "offer_id", ... }] }
 * Outros eventos (PIX gerado, boleto, carrinho abandonado...) viram 'ignored'.
 */
function parseKirvano(body: Record<string, unknown>): ParsedEvent | null {
  const customer = (body.customer ?? {}) as Record<string, unknown>;
  const transactionId = str(body.sale_id) ?? str(body.checkout_id);
  const email = str(customer.email)?.toLowerCase() ?? null;
  if (!transactionId || !email) return null;

  const rawEvent = str(body.event)?.toUpperCase();
  const event: PurchaseEvent =
    rawEvent === 'SALE_APPROVED'
      ? 'approved'
      : rawEvent === 'SALE_REFUNDED'
        ? 'refunded'
        : rawEvent === 'SALE_CHARGEBACK'
          ? 'chargeback'
          : 'ignored';

  const products = Array.isArray(body.products) ? (body.products as Record<string, unknown>[]) : [];
  const productIds = products
    .flatMap((p) => [str(p?.id), str(p?.offer_id)])
    .filter((id): id is string => !!id);

  return {
    gateway: 'kirvano',
    event,
    transactionId,
    email,
    name: str(customer.name),
    phone: str(customer.phone_number),
    productIds,
  };
}

/**
 * UNICA parte que depende do gateway. Alem da Kirvano, aceita o formato normalizado abaixo
 * (usado nos testes com curl):
 *   { "event": "approved", "transaction_id": "...", "email": "...", "name": "...",
 *     "phone": "...", "product_id": "..." }
 */
function parseGatewayEvent(body: Record<string, unknown>): ParsedEvent | null {
  if (body.customer && typeof body.customer === 'object') return parseKirvano(body);

  const transactionId = str(body.transaction_id);
  const email = str(body.email)?.toLowerCase() ?? null;
  if (!transactionId || !email) return null;

  const rawEvent = str(body.event);
  const event: PurchaseEvent =
    rawEvent === 'approved' || rawEvent === 'refunded' || rawEvent === 'chargeback'
      ? rawEvent
      : 'ignored';

  const productId = str(body.product_id);
  return {
    gateway: str(body.gateway) ?? 'generic',
    event,
    transactionId,
    email,
    name: str(body.name),
    phone: str(body.phone),
    productIds: productId ? [productId] : [],
  };
}

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

/** Data de hoje (YYYY-MM-DD) no fuso de Brasilia, deslocada em `offsetDays`. */
function brasiliaDate(offsetDays = 0): string {
  const now = new Date(Date.now() + offsetDays * 86_400_000);
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/** Copia o template de treino para um workout_plan novo do aluno (mesmos campos do admin). */
async function copyWorkoutTemplate(db: SupabaseClient, clientId: string, templateId: string) {
  const { data: days, error: daysError } = await db
    .from('workout_template_days')
    .select('day_of_week, workout_type, workout_template_exercises (*)')
    .eq('template_id', templateId);
  if (daysError) throw daysError;
  if (!days || days.length === 0) throw new Error(`template ${templateId} sem dias`);

  const { data: plan, error: planError } = await db
    .from('workout_plans')
    .insert({ client_id: clientId })
    .select('id')
    .single();
  if (planError) throw planError;

  try {
    await copyDays(db, plan.id, days);
  } catch (err) {
    // Desfaz o plano parcial: senao o reenvio do gateway veria "ja tem treino" e pularia a copia.
    await db.from('daily_workouts').delete().eq('workout_plan_id', plan.id);
    await db.from('workout_plans').delete().eq('id', plan.id);
    throw err;
  }
}

// deno-lint-ignore no-explicit-any
async function copyDays(db: SupabaseClient, planId: string, days: any[]) {
  for (const day of days) {
    // deno-lint-ignore no-explicit-any
    const exercises = (day.workout_template_exercises as any[]) || [];
    if (!day.workout_type && exercises.length === 0) continue;

    const { data: dw, error: dwError } = await db
      .from('daily_workouts')
      .insert({ workout_plan_id: planId, day_of_week: day.day_of_week, workout_type: day.workout_type })
      .select('id')
      .single();
    if (dwError) throw dwError;

    const rows = exercises
      .filter((ex) => ex.name && String(ex.name).trim() !== '')
      .sort((a, b) => a.order_index - b.order_index)
      .map((ex) => ({
        daily_workout_id: dw.id,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        rest: ex.rest,
        weight_kg: ex.weight_kg,
        video_url: ex.video_url,
        notes: ex.notes,
        order_index: ex.order_index,
        technique_id: ex.technique_id,
        effort_parameter_id: ex.effort_parameter_id,
      }));

    if (rows.length > 0) {
      const { error: exError } = await db.from('exercises').insert(rows);
      if (exError) throw exError;
    }
  }
}

/**
 * Profile pelo e-mail, sem diferenciar maiusculas (cadastros antigos podem ter e-mail misto).
 * Erro de query PROPAGA: tratar como "nao existe" levaria a criar/rebaixar o aluno errado.
 * Com mais de um profile no mesmo e-mail, prefere o 'full' (nunca rebaixar).
 */
async function findProfileByEmail(
  db: SupabaseClient,
  email: string
): Promise<{ id: string; access_tier: string } | null> {
  const pattern = email.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data, error } = await db
    .from('profiles')
    .select('id, access_tier')
    .ilike('email', pattern)
    .order('access_tier', { ascending: true }) // 'full' < 'low_ticket'
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

async function findAuthUserIdByEmail(db: SupabaseClient, email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email);
    if (found) return found.id;
    if (data.users.length < 1000) return null;
  }
  return null;
}

/** Retorna { clientId, status, note } — note explica o que foi (ou nao foi) feito, para o log. */
async function handleApproved(db: SupabaseClient, ev: ParsedEvent) {
  if (ev.productIds.length === 0) return { clientId: null, status: 'ignored', note: 'sem product_id' };

  const { data: products, error: productError } = await db
    .from('purchase_products')
    .select('access_tier, workout_template_id, active')
    .in('gateway_product_id', ev.productIds)
    .eq('active', true)
    .limit(1);
  if (productError) throw productError;
  const product = products?.[0];
  if (!product) {
    return {
      clientId: null,
      status: 'ignored',
      note: `produto nao cadastrado/ativo: ${ev.productIds.join(', ')}`,
    };
  }

  let existing = await findProfileByEmail(db, ev.email);
  let clientId: string;

  if (!existing) {
    const appUrl = Deno.env.get('APP_URL');
    const { data: invited, error: inviteError } = await db.auth.admin.inviteUserByEmail(ev.email, {
      data: { full_name: ev.name ?? '' },
      ...(appUrl ? { redirectTo: `${appUrl}/definir-senha` } : {}),
    });
    if (invited?.user) {
      clientId = invited.user.id;
    } else {
      // Usuario do Auth ja existe: reenvio depois de uma falha no meio, ou aluno cujo e-mail
      // no profile difere do login. Rele o profile pelo id para NUNCA sobrescrever um aluno.
      const authId = await findAuthUserIdByEmail(db, ev.email);
      if (!authId) {
        throw new Error(`convite falhou para ${ev.email}: ${inviteError?.message ?? 'sem usuario'}`);
      }
      clientId = authId;
      const { data: byId, error: byIdError } = await db
        .from('profiles')
        .select('id, access_tier')
        .eq('id', authId)
        .maybeSingle();
      if (byIdError) throw byIdError;
      existing = byId;
    }
  } else {
    clientId = existing.id;
  }

  if (existing) {
    if (existing.access_tier !== 'low_ticket') {
      // Aluno completo comprou o low ticket: nao rebaixa, so registra a compra.
      return { clientId, status: 'processed', note: 'aluno ja e full, nada alterado' };
    }
    // Recompra depois de reembolso: reativa (vitalicio).
    const { error } = await db
      .from('profiles')
      .update({ plan_end_date: null, is_active: true })
      .eq('id', clientId);
    if (error) throw error;
  } else {
    // So aqui nasce um aluno low ticket: conta criada agora pelo webhook.
    const today = brasiliaDate();
    const { error: profileError } = await db.from('profiles').upsert(
      {
        id: clientId,
        role: 'client',
        access_tier: 'low_ticket',
        full_name: ev.name ?? ev.email.split('@')[0],
        email: ev.email,
        phone: ev.phone,
        is_active: true,
        coaching_start_date: today,
        plan_start_date: today,
        plan_end_date: null,
        locale: 'pt-BR',
        unit_system: 'metric',
      },
      { onConflict: 'id' }
    );
    if (profileError) throw profileError;
  }

  if (product.workout_template_id) {
    const { count } = await db
      .from('workout_plans')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId);
    if (!count) await copyWorkoutTemplate(db, clientId, product.workout_template_id);
  }

  return { clientId, status: 'processed', note: existing ? 'low ticket reativado' : 'aluno criado' };
}

async function handleRevoked(db: SupabaseClient, ev: ParsedEvent) {
  const existing = await findProfileByEmail(db, ev.email);
  if (!existing) return { clientId: null, status: 'ignored', note: 'aluno nao encontrado' };
  if (existing.access_tier !== 'low_ticket') {
    return { clientId: existing.id, status: 'ignored', note: 'aluno full, acesso mantido' };
  }

  const { error } = await db
    .from('profiles')
    .update({ plan_end_date: brasiliaDate(-1) })
    .eq('id', existing.id);
  if (error) throw error;
  return { clientId: existing.id, status: 'processed', note: `acesso encerrado (${ev.event})` };
}

serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  // Gateways diferentes autenticam de jeitos diferentes: aceita header ou ?token= na URL.
  const secret = Deno.env.get('WEBHOOK_SECRET');
  const provided = req.headers.get('x-webhook-secret') ?? new URL(req.url).searchParams.get('token');
  if (!secret || provided !== secret) return json(401, { error: 'unauthorized' });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid json' });
  }

  const ev = parseGatewayEvent(body);
  if (!ev) {
    // Evento sem venda/e-mail (ex.: carrinho abandonado da Kirvano): nada a fazer. Responde 200
    // para o gateway nao ficar reenviando; o body vai pro log da function para conferencia.
    console.error('purchase-webhook: payload nao reconhecido', JSON.stringify(body));
    return typeof body.event === 'string'
      ? json(200, { ok: true, ignored: true })
      : json(400, { error: 'payload nao reconhecido' });
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const logEvent = (fields: Record<string, unknown>) =>
    db.from('purchases').upsert(
      {
        gateway: ev.gateway,
        transaction_id: ev.transactionId,
        event: ev.event,
        email: ev.email,
        product_id: ev.productIds.join(",") || null,
        payload: body,
        ...fields,
      },
      { onConflict: 'transaction_id,event' }
    );

  // Idempotencia: o gateway reenvia o mesmo evento; se ja foi processado, nao faz nada.
  const { data: already } = await db
    .from('purchases')
    .select('status')
    .eq('transaction_id', ev.transactionId)
    .eq('event', ev.event)
    .maybeSingle();
  if (already?.status === 'processed') return json(200, { ok: true, duplicate: true });

  try {
    const result =
      ev.event === 'approved'
        ? await handleApproved(db, ev)
        : ev.event === 'refunded' || ev.event === 'chargeback'
          ? await handleRevoked(db, ev)
          : { clientId: null, status: 'ignored', note: 'evento ignorado' };

    if (result.status === 'ignored') {
      console.warn('purchase-webhook ignorado:', ev.transactionId, ev.email, result.note);
    }
    await logEvent({ client_id: result.clientId, status: result.status, error: result.note });
    return json(200, { ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('purchase-webhook erro:', ev.transactionId, ev.email, message);
    await logEvent({ status: 'error', error: message });
    // 500 faz o gateway reenviar; a idempotencia evita duplicar o que ja deu certo.
    return json(500, { error: message });
  }
});
