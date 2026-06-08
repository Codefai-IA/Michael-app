// Lógica de destaques de progresso e formatação de tempo do acompanhamento de treino.

export interface LoggedSet {
  set: number;
  weight: number;
  reps: number;
}

export interface ExerciseSession {
  id: string;
  name: string;
  sets: LoggedSet[];
}

export interface WorkoutHighlight {
  exerciseName: string;
  message: string;
}

// Formata número sem casas decimais desnecessárias (225 -> "225", 22.5 -> "22.5")
function fmtNum(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toString();
}

function maxWeight(sets: LoggedSet[]): number {
  return sets.reduce((max, s) => (s.weight > max ? s.weight : max), 0);
}

function maxReps(sets: LoggedSet[]): number {
  return sets.reduce((max, s) => (s.reps > max ? s.reps : max), 0);
}

// Considera apenas séries com algum dado registrado (peso ou reps > 0)
function hasMeaningfulData(sets: LoggedSet[]): boolean {
  return sets.some((s) => s.weight > 0 || s.reps > 0);
}

/**
 * Para cada exercício, escolhe NO MÁXIMO 1 destaque com a seguinte prioridade:
 *   1. Carga: aumento na maior carga em relação à última sessão.
 *   2. Reps:  com a mesma carga máxima, aumento no número de repetições.
 * Exercícios sem dados suficientes (sem sessão anterior ou sem registro hoje) são omitidos.
 */
export function computeWorkoutHighlights(
  today: ExerciseSession[],
  previousByExercise: Map<string, LoggedSet[]>
): WorkoutHighlight[] {
  const highlights: WorkoutHighlight[] = [];

  for (const exercise of today) {
    const todaySets = exercise.sets;
    const prevSets = previousByExercise.get(exercise.id);

    // Precisa de dados de hoje E de uma sessão anterior para comparar
    if (!hasMeaningfulData(todaySets) || !prevSets || !hasMeaningfulData(prevSets)) {
      continue;
    }

    const wToday = maxWeight(todaySets);
    const wPrev = maxWeight(prevSets);

    // 1. Evolução de carga
    if (wToday > 0 && wPrev > 0 && wToday > wPrev) {
      highlights.push({
        exerciseName: exercise.name,
        message: `${exercise.name} evoluiu de ${fmtNum(wPrev)}kg para ${fmtNum(wToday)}kg.`,
      });
      continue;
    }

    // 2. Evolução de repetições (mesma carga máxima, ou exercícios sem carga)
    if (wToday === wPrev) {
      const rToday = maxReps(todaySets);
      const rPrev = maxReps(prevSets);
      if (rToday > 0 && rPrev > 0 && rToday > rPrev) {
        highlights.push({
          exerciseName: exercise.name,
          message: `${exercise.name} aumentou de ${fmtNum(rPrev)} para ${fmtNum(rToday)} repetições.`,
        });
        continue;
      }
    }

    // Sem progresso identificável -> omite
  }

  return highlights;
}

// Formata duração total para o resumo: "1h20", "2h05", "45min", "menos de 1 minuto"
export function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 1) return 'menos de 1 minuto';

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h${String(minutes).padStart(2, '0')}` : `${hours}h`;
  }
  return `${minutes}min`;
}

// Formata o cronômetro ao vivo: "MM:SS" ou "H:MM:SS"
export function formatTimer(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
