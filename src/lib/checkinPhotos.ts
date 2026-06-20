import { supabase } from './supabase';
import type { CheckinPhoto, CheckinPhotoType } from '../types/database';

const BUCKET = 'checkin-photos';

export interface UploadCheckinPhotoParams {
  clientId: string;
  date: string;            // YYYY-MM-DD (fuso Brasília)
  type: CheckinPhotoType;  // 'diet' | 'workout'
  blob: Blob;
  takenAt: Date;           // momento exato do clique
  mealId?: string | null;  // dieta: qual refeição
  activityType?: string | null; // treino: tipo (corrida, bike, musculacao...)
}

/** URL pública de um storage_path do bucket de check-in. */
export function getCheckinPhotoUrl(storagePath: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Faz upload da foto crua no Storage e registra em checkin_photos.
 * Caminho: {clientId}/{date}/{type}-{timestamp}.jpg
 * Retorna a linha inserida ou null em caso de falha.
 */
export async function uploadCheckinPhoto(
  params: UploadCheckinPhotoParams
): Promise<CheckinPhoto | null> {
  const { clientId, date, type, blob, takenAt, mealId = null, activityType = null } = params;

  const storagePath = `${clientId}/${date}/${type}-${takenAt.getTime()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, blob, {
      cacheControl: '3600',
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    console.error('Erro no upload da foto de check-in:', uploadError);
    return null;
  }

  const { data, error: insertError } = await supabase
    .from('checkin_photos')
    .insert({
      client_id: clientId,
      date,
      type,
      storage_path: storagePath,
      taken_at: takenAt.toISOString(),
      meal_id: mealId,
      activity_type: activityType,
    })
    .select()
    .single();

  if (insertError) {
    console.error('Erro ao registrar foto de check-in:', insertError);
    // Tenta limpar o arquivo órfão
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
    return null;
  }

  return data as CheckinPhoto;
}

/** Retorna as fotos de check-in de um cliente em um dia. */
export async function getDayCheckinPhotos(
  clientId: string,
  date: string
): Promise<CheckinPhoto[]> {
  const { data, error } = await supabase
    .from('checkin_photos')
    .select('*')
    .eq('client_id', clientId)
    .eq('date', date)
    .order('taken_at', { ascending: true });

  if (error) {
    console.error('Erro ao buscar fotos do dia:', error);
    return [];
  }
  return (data as CheckinPhoto[]) ?? [];
}

/** Existe ao menos uma foto de dieta no dia? (gate antifraude de pontos) */
export async function hasDietPhoto(clientId: string, date: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('checkin_photos')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('date', date)
    .eq('type', 'diet');

  if (error) {
    console.error('Erro ao verificar foto de dieta:', error);
    return false;
  }
  return (count ?? 0) > 0;
}
