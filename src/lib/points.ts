import { supabase } from './supabase';

/**
 * Award workout points for a day (fire-and-forget).
 * Only awards once per day due to UNIQUE constraint on points_log.
 */
export async function maybeAwardWorkoutPoints(clientId: string, date: string) {
  try {
    const yearMonth = date.substring(0, 7);

    // Try to insert - will fail silently if already awarded today
    const { error } = await supabase
      .from('points_log')
      .insert({
        client_id: clientId,
        date,
        action_type: 'workout_day' as const,
        points: 10,
      });

    if (error) return; // Already awarded today (unique constraint violation)

    // Increment monthly points via RPC
    await supabase.rpc('increment_monthly_points', {
      p_client_id: clientId,
      p_year_month: yearMonth,
      p_workout_points: 10,
      p_diet_points: 0,
    });
  } catch (err) {
    console.error('Error awarding workout points:', err);
  }
}

/**
 * Award diet points for a day (fire-and-forget).
 * Only awards once per day due to UNIQUE constraint on points_log.
 */
export async function maybeAwardDietPoints(clientId: string, date: string) {
  try {
    const yearMonth = date.substring(0, 7);

    const { error } = await supabase
      .from('points_log')
      .insert({
        client_id: clientId,
        date,
        action_type: 'diet_day' as const,
        points: 10,
      });

    if (error) return;

    await supabase.rpc('increment_monthly_points', {
      p_client_id: clientId,
      p_year_month: yearMonth,
      p_workout_points: 0,
      p_diet_points: 10,
    });
  } catch (err) {
    console.error('Error awarding diet points:', err);
  }
}

/**
 * Award water points for reaching the daily water goal (fire-and-forget).
 * Awards 2 points, once per day due to UNIQUE constraint on points_log.
 */
export async function maybeAwardWaterPoints(clientId: string, date: string) {
  try {
    const yearMonth = date.substring(0, 7);

    const { error } = await supabase
      .from('points_log')
      .insert({
        client_id: clientId,
        date,
        action_type: 'water_day' as const,
        points: 2,
      });

    if (error) {
      console.error('Water points insert error:', error);
      return;
    }

    console.log('Water points awarded successfully!');

    await supabase.rpc('increment_monthly_points', {
      p_client_id: clientId,
      p_year_month: yearMonth,
      p_workout_points: 0,
      p_diet_points: 0,
      p_water_points: 2,
    });
  } catch (err) {
    console.error('Error awarding water points:', err);
  }
}
