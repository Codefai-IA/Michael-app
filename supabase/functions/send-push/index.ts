import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.7';

/**
 * Textos das notificacoes por idioma.
 *
 * Duplicados aqui de proposito: esta funcao roda em Deno, sem acesso ao bundle do app, e o
 * chamador manda apenas a CHAVE (message_key) — quem resolve o idioma e este arquivo, que e
 * o unico ponto com acesso ao profiles.locale no momento do envio.
 */
const PUSH_MESSAGES: Record<string, Record<string, { title: string; body: string }>> = {
  'pt-BR': {
    diet_updated: {
      title: 'Dieta Atualizada!',
      body: 'Seu nutricionista atualizou sua dieta. Confira agora!',
    },
    workout_updated: {
      title: 'Treino Atualizado!',
      body: 'Seu treinador atualizou seu treino. Confira agora!',
    },
  },
  en: {
    diet_updated: {
      title: 'Diet Updated!',
      body: 'Your nutritionist updated your diet. Check it out!',
    },
    workout_updated: {
      title: 'Workout Updated!',
      body: 'Your coach updated your workout. Check it out!',
    },
  },
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { client_id, title, body, url, message_key } = await req.json();

    if (!client_id) {
      return new Response(
        JSON.stringify({ error: 'client_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: subscriptions } = await supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('client_id', client_id);

    // O service worker nao tem como saber o idioma do aluno (roda fora do React e sem
    // sessao), entao o payload precisa sair daqui ja traduzido.
    let resolved: { title: string; body: string } | null = null;
    if (message_key) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('locale')
        .eq('id', client_id)
        .maybeSingle();

      const locale = profile?.locale === 'en' ? 'en' : 'pt-BR';
      resolved = PUSH_MESSAGES[locale]?.[message_key] ?? PUSH_MESSAGES['pt-BR'][message_key] ?? null;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT')!,
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!
    );

    const payload = JSON.stringify({
      title: resolved?.title || title || 'MC Nutri',
      body: resolved?.body || body || 'Sua dieta foi atualizada!',
      url: url || '/dieta',
    });

    let sent = 0;
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
        sent++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabaseAdmin
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint);
        }
        console.error('Push send error:', err.message);
      }
    }

    return new Response(
      JSON.stringify({ sent }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
