import { supabase } from './supabase';

/**
 * Notify a client that their diet was updated (fire-and-forget).
 */
export async function notifyDietUpdated(clientId: string): Promise<void> {
  try {
    await supabase.functions.invoke('send-push', {
      body: {
        client_id: clientId,
        title: 'Dieta Atualizada!',
        body: 'Seu nutricionista atualizou sua dieta. Confira agora!',
        url: '/dieta',
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
        title: 'Treino Atualizado!',
        body: 'Seu treinador atualizou seu treino. Confira agora!',
        url: '/treino',
      },
    });
  } catch (err) {
    console.error('Error sending workout notification:', err);
  }
}
