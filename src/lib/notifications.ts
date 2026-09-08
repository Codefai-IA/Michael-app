import { supabase } from './supabase';

/**
 * Notify a client that their diet was updated (fire-and-forget).
 */
export async function notifyDietUpdated(clientId: string): Promise<void> {
  try {
    await supabase.functions.invoke('send-push', {
      body: {
        client_id: clientId,
        // message_key: a Edge Function le profiles.locale e resolve o idioma do aluno (o
        // admin que dispara isto esta sempre em pt-BR, entao nao da para montar o texto aqui).
        // title/body continuam sendo enviados como FALLBACK: enquanto a funcao nova nao for
        // publicada, a versao antiga ignora message_key e usa estes — mantendo exatamente o
        // texto que os alunos recebem hoje, em vez de cair no generico "MC Nutri".
        message_key: 'diet_updated',
        title: 'Dieta Atualizada!',
        body: 'Seu nutricionista atualizou sua dieta. Confira agora!',
        url: '/app/dieta',
      },
    });
  } catch (err) {
    console.error('Error sending diet notification:', err);
  }
}

/**
 * Notify a client that their workout was updated (fire-and-forget).
 */
export async function notifyWorkoutUpdated(clientId: string): Promise<void> {
  try {
    await supabase.functions.invoke('send-push', {
      body: {
        client_id: clientId,
        // Mesmo esquema do diet: chave + fallback pt-BR (ver comentario acima).
        message_key: 'workout_updated',
        title: 'Treino Atualizado!',
        body: 'Seu treinador atualizou seu treino. Confira agora!',
        url: '/app/treino',
      },
    });
  } catch (err) {
    console.error('Error sending workout notification:', err);
  }
}
