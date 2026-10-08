import type { ExerciseLogSet } from '../types/database';
import { normalizeKey } from './normalizeKey';

/**
 * Progressao de carga do ALUNO (fim da aba Treino). Funcoes puras, sem React/Supabase.
 *
 * Diferente do admin (LoadProgression.tsx), o historico e ligado pelo NOME do exercicio, e nao so
 * pelo exercise_id: quando o treinador reaplica um template, os exercicios sao recriados com ids
 * novos e, pelo id, o grafico do aluno recomecaria do zero.
 */

export const PROGRESSION_WEEKS = 12;
const DAY_MS = 86_400_000;

export interface ProgressionLog {
  exercise_id: string;
  date: string;
  sets_completed: ExerciseLogSet[] | null;
}

export interface WeeklyPoint {
  weekStart: string;
  maxWeight: number;
}

export interface ProgressionSession {
  date: string;
  sets: ExerciseLogSet[];
}

export interface Progression {
  /** Carga maxima por semana, da mais antiga para a mais recente. So semanas com carga > 0. */
  weekly: WeeklyPoint[];
  /** Sessoes registradas, da mais recente para a mais antiga. */
  sessions: ProgressionSession[];
  /** As duas semanas mais recentes com carga (para "vs semana anterior"). */
  latest: WeeklyPoint | null;
  previous: WeeklyPoint | null;
}

function toUtcMs(date: string): number {
  return Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Segunda-feira (YYYY-MM-DD) da semana de `date`. Em UTC puro: com `new Date(local)`, como no
 * admin, a semana desloca um dia para quem esta fora do fuso do Brasil.
 */
export function weekStartKey(date: string): string {
  const ms = toUtcMs(date);
  const daysSinceMonday = (new Date(ms).getUTCDay() + 6) % 7;
  return fromUtcMs(ms - daysSinceMonday * DAY_MS);
}

/** Primeiro dia (segunda) da janela de PROGRESSION_WEEKS semanas que termina na semana de `today`. */
export function progressionStartDate(today: string): string {
  return fromUtcMs(toUtcMs(weekStartKey(today)) - (PROGRESSION_WEEKS - 1) * 7 * DAY_MS);
}

/**
 * O log pertence ao exercicio alvo? Mesmo id (cobre exercicio renomeado) ou mesmo nome normalizado
 * (cobre template reaplicado e o mesmo exercicio em dias diferentes). Recebe o nome CRU do banco —
 * nunca o traduzido por tc().
 */
export function matchesExercise(
  target: { id: string; name: string },
  logExerciseId: string,
  logExerciseName: string | undefined
): boolean {
  if (logExerciseId === target.id) return true;
  if (!logExerciseName) return false;
  return normalizeKey(logExerciseName) === normalizeKey(target.name);
}

function cleanSets(sets: ExerciseLogSet[] | null): ExerciseLogSet[] {
  return (sets || [])
    .map((s) => ({ set: Number(s.set) || 0, weight: Number(s.weight) || 0, reps: Number(s.reps) || 0 }))
    .filter((s) => s.weight > 0 || s.reps > 0);
}

export function buildProgression(
  logs: ProgressionLog[],
  nameById: Map<string, string>,
  target: { id: string; name: string },
  today: string
): Progression {
  const start = progressionStartDate(today);

  const sessions: ProgressionSession[] = logs
    .filter((l) => l.date >= start && matchesExercise(target, l.exercise_id, nameById.get(l.exercise_id)))
    .map((l) => ({ date: l.date.slice(0, 10), sets: cleanSets(l.sets_completed) }))
    // Sessao toda zerada = auto-save de campo vazio, nao e treino.
    .filter((s) => s.sets.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date));

  const weekMax = new Map<string, number>();
  for (const session of sessions) {
    const max = Math.max(...session.sets.map((s) => s.weight));
    const key = weekStartKey(session.date);
    weekMax.set(key, Math.max(weekMax.get(key) ?? 0, max));
  }

  const weekly = [...weekMax.entries()]
    .filter(([, maxWeight]) => maxWeight > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, maxWeight]) => ({ weekStart, maxWeight }));

  return {
    weekly,
    sessions,
    latest: weekly[weekly.length - 1] ?? null,
    previous: weekly[weekly.length - 2] ?? null,
  };
}
