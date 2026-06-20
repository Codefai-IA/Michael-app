import { useState, useCallback, useEffect, useRef } from 'react';
import { Plus, Minus, Check, ChevronDown, ChevronUp, Play, Square, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { usePageData } from '../../hooks';
import { PageContainer, Header, BottomNav } from '../../components/layout';
import { Card, Checkbox, YouTubeEmbed, TechniqueBadge, WorkoutSummaryModal, CameraCapture } from '../../components/ui';
import type { DailyWorkout, Exercise } from '../../types/database';
import { maybeAwardWorkoutPoints } from '../../lib/points';
import { uploadCheckinPhoto } from '../../lib/checkinPhotos';
import {
  computeWorkoutHighlights,
  formatTimer,
  type LoggedSet,
  type WorkoutHighlight,
} from '../../lib/workoutProgress';
import styles from './Workout.module.css';

// Chave do localStorage para a sessão de treino em andamento (sobrevive a reload/fechar o app)
function sessionStorageKey(dailyWorkoutId: string, date: string): string {
  return `workout_session_${dailyWorkoutId}_${date}`;
}

// Retorna a data atual no fuso horário de Brasília
function getBrasiliaDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

// Dias da semana
const WEEKDAYS = [
  { index: 0, short: 'Dom', full: 'Domingo' },
  { index: 1, short: 'Seg', full: 'Segunda' },
  { index: 2, short: 'Ter', full: 'Terca' },
  { index: 3, short: 'Qua', full: 'Quarta' },
  { index: 4, short: 'Qui', full: 'Quinta' },
  { index: 5, short: 'Sex', full: 'Sexta' },
  { index: 6, short: 'Sab', full: 'Sabado' },
];

// Formatar tempo de descanso para exibição
const formatRestTime = (rest: string | null): string => {
  if (!rest) return '';
  const restLabels: Record<string, string> = {
    '45s': '45s',
    '1min': '1min',
    '1min30s': '1:30',
    '2min': '2min',
    '2min30s': '2:30',
    '3min': '3min',
  };
  return restLabels[rest] || rest;
};

interface SetLog {
  set: number;
  weight: string;
  reps: string;
}

interface ExerciseLog {
  [exerciseId: string]: {
    sets: SetLog[];
    saved: boolean;
    expanded: boolean;
  };
}

export function Workout() {
  const { profile } = useAuth();
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [workout, setWorkout] = useState<DailyWorkout | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [completedExercises, setCompletedExercises] = useState<string[]>([]);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog>({});
  const [savingExercise, setSavingExercise] = useState<string | null>(null);
  const [autoSaving, setAutoSaving] = useState<Set<string>>(new Set());
  const autoSaveTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const exerciseLogsRef = useRef<ExerciseLog>({});
  const [currentDate, setCurrentDate] = useState(getBrasiliaDate());
  const currentDateRef = useRef(currentDate);
  const fetchAllDataRef = useRef<(() => Promise<void>) | undefined>(undefined);

  // Acompanhamento de treino: cronômetro e resumo de conclusão
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [summary, setSummary] = useState<{ durationMs: number; highlights: WorkoutHighlight[] } | null>(null);
  // Resumo aguardando a foto pós-treino obrigatória (antifraude)
  const [pendingSummary, setPendingSummary] = useState<{ durationMs: number; highlights: WorkoutHighlight[] } | null>(null);
  const [showWorkoutCamera, setShowWorkoutCamera] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Manter ref sincronizado com o estado
  useEffect(() => {
    exerciseLogsRef.current = exerciseLogs;
  }, [exerciseLogs]);

  // Manter ref da data sincronizada
  useEffect(() => {
    currentDateRef.current = currentDate;
  }, [currentDate]);

  const fetchAllData = useCallback(async () => {
    if (!profile?.id) return;

    // Usar ref para garantir data mais atual (evita stale closure)
    const today = currentDateRef.current;

    // Buscar workout plan e progresso em paralelo
    const [planResult, progressResult] = await Promise.all([
      supabase
        .from('workout_plans')
        .select('id')
        .eq('client_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('daily_progress')
        .select('exercises_completed')
        .eq('client_id', profile.id)
        .eq('date', today)
        .maybeSingle()
    ]);

    if (progressResult.data) {
      setCompletedExercises(progressResult.data.exercises_completed || []);
    }

    const workoutPlan = planResult.data?.[0];
    if (!workoutPlan) {
      setWorkout(null);
      setExercises([]);
      setExerciseLogs({});
      return;
    }

    // Buscar daily workout
    const { data: dailyWorkout } = await supabase
      .from('daily_workouts')
      .select('*')
      .eq('workout_plan_id', workoutPlan.id)
      .eq('day_of_week', selectedDay)
      .maybeSingle();

    if (!dailyWorkout) {
      setWorkout(null);
      setExercises([]);
      setExerciseLogs({});
      return;
    }

    setWorkout(dailyWorkout);

    // Buscar exercicios
    const { data: exercisesData } = await supabase
      .from('exercises')
      .select('*')
      .eq('daily_workout_id', dailyWorkout.id)
      .order('order_index');

    const exercises = exercisesData || [];
    setExercises(exercises);

    if (exercises.length === 0) {
      setExerciseLogs({});
      return;
    }

    // Buscar logs mais recentes de cada exercício (sem filtrar por data)
    // Ordenado por data DESC para pegar o mais recente primeiro
    const exerciseIds = exercises.map(e => e.id);
    const { data: allLogs } = await supabase
      .from('exercise_logs')
      .select('*')
      .eq('client_id', profile.id)
      .in('exercise_id', exerciseIds)
      .order('date', { ascending: false });

    const logs = allLogs || [];

    // Processar logs - pegar o mais recente de cada exercício
    const newLogs: ExerciseLog = {};
    exercises.forEach(exercise => {
      // Encontra o log mais recente deste exercício (já está ordenado por data DESC)
      const mostRecentLog = logs.find(l => l.exercise_id === exercise.id);
      const plannedSets = parseInt(exercise.sets?.toString() || '3');

      if (mostRecentLog && mostRecentLog.sets_completed) {
        // Usa os dados do último treino salvo
        newLogs[exercise.id] = {
          sets: mostRecentLog.sets_completed.map((s: { set: number; weight: number; reps: number }) => ({
            set: s.set,
            weight: s.weight?.toString() || '',
            reps: s.reps?.toString() || '',
          })),
          saved: false, // Marcar como não salvo para hoje
          expanded: false,
        };
      } else {
        // Sem histórico - usar valores padrão do exercício
        newLogs[exercise.id] = {
          sets: Array.from({ length: plannedSets }, (_, i) => ({
            set: i + 1,
            weight: exercise.weight_kg?.toString() || '',
            reps: '',
          })),
          saved: false,
          expanded: false,
        };
      }
    });

    setExerciseLogs(newLogs);
  }, [profile?.id, selectedDay]);

  // Manter ref de fetchAllData atualizada
  useEffect(() => {
    fetchAllDataRef.current = fetchAllData;
  }, [fetchAllData]);

  // Verificar mudança de dia a cada minuto (evita dados salvos com data errada após meia-noite)
  useEffect(() => {
    const checkDayChange = () => {
      const newDate = getBrasiliaDate();
      if (newDate !== currentDateRef.current) {
        console.log('[Workout] Dia mudou:', currentDateRef.current, '->', newDate);
        currentDateRef.current = newDate;
        setCurrentDate(newDate);
        // Refetch para carregar dados do novo dia
        fetchAllDataRef.current?.();
      }
    };

    const interval = setInterval(checkDayChange, 60000); // Verifica a cada minuto
    return () => clearInterval(interval);
  }, []);

  // Hook que gerencia loading e refetch automático
  const { isInitialLoading: loading } = usePageData({
    userId: profile?.id,
    fetchData: fetchAllData,
    dependencies: [selectedDay],
  });

  async function toggleExercise(exerciseId: string) {
    const isCompleted = completedExercises.includes(exerciseId);
    const newCompleted = isCompleted
      ? completedExercises.filter(id => id !== exerciseId)
      : [...completedExercises, exerciseId];

    setCompletedExercises(newCompleted);

    // Usar ref para garantir data mais atual
    const today = currentDateRef.current;

    const { data: existing } = await supabase
      .from('daily_progress')
      .select('id')
      .eq('client_id', profile!.id)
      .eq('date', today)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('daily_progress')
        .update({ exercises_completed: newCompleted })
        .eq('id', existing.id);
    } else {
      await supabase.from('daily_progress').insert({
        client_id: profile!.id,
        date: today,
        exercises_completed: newCompleted,
        meals_completed: [],
        water_consumed_ml: 0,
      });
    }

    // Award points when ALL exercises for the day are completed
    if (!isCompleted && newCompleted.length === exercises.length && exercises.length > 0) {
      maybeAwardWorkoutPoints(profile!.id, today);
    }
  }

  // Toggle expandir/colapsar exercício
  function toggleExpand(exerciseId: string) {
    setExerciseLogs(prev => ({
      ...prev,
      [exerciseId]: {
        ...prev[exerciseId],
        expanded: !prev[exerciseId]?.expanded,
      },
    }));
  }

  // Atualizar set específico
  function updateSet(exerciseId: string, setIndex: number, field: 'weight' | 'reps', value: string) {
    setExerciseLogs(prev => {
      const exerciseLog = prev[exerciseId];
      const newSets = [...exerciseLog.sets];
      newSets[setIndex] = {
        ...newSets[setIndex],
        [field]: value,
      };
      return {
        ...prev,
        [exerciseId]: {
          ...exerciseLog,
          sets: newSets,
          saved: false,
        },
      };
    });
    // Agendar auto-save
    scheduleAutoSave(exerciseId);
  }

  // Adicionar série
  function addSet(exerciseId: string) {
    setExerciseLogs(prev => {
      const exerciseLog = prev[exerciseId];
      const lastSet = exerciseLog.sets[exerciseLog.sets.length - 1];
      return {
        ...prev,
        [exerciseId]: {
          ...exerciseLog,
          sets: [
            ...exerciseLog.sets,
            {
              set: exerciseLog.sets.length + 1,
              weight: lastSet?.weight || '',
              reps: '',
            },
          ],
          saved: false,
        },
      };
    });
    // Agendar auto-save
    scheduleAutoSave(exerciseId);
  }

  // Remover última série
  function removeSet(exerciseId: string) {
    setExerciseLogs(prev => {
      const exerciseLog = prev[exerciseId];
      if (exerciseLog.sets.length <= 1) return prev;
      return {
        ...prev,
        [exerciseId]: {
          ...exerciseLog,
          sets: exerciseLog.sets.slice(0, -1),
          saved: false,
        },
      };
    });
    // Agendar auto-save
    scheduleAutoSave(exerciseId);
  }

  // Salvar log do exercício
  async function saveExerciseLog(exerciseId: string, exercise: Exercise, isAutoSave = false) {
    if (!isAutoSave) {
      setSavingExercise(exerciseId);
    }
    // Usar ref para evitar stale closure no auto-save
    const exerciseLog = exerciseLogsRef.current[exerciseId];
    // Usar ref para garantir data mais atual
    const today = currentDateRef.current;

    try {
      const setsToSave = exerciseLog.sets.map(s => ({
        set: s.set,
        weight: parseFloat(s.weight) || 0,
        reps: parseFloat(s.reps) || 0,
      }));

      const { data: existing } = await supabase
        .from('exercise_logs')
        .select('id')
        .eq('client_id', profile!.id)
        .eq('exercise_id', exerciseId)
        .eq('date', today)
        .maybeSingle();

      if (existing) {
        const { error: updateError } = await supabase
          .from('exercise_logs')
          .update({ sets_completed: setsToSave })
          .eq('id', existing.id);

        if (updateError) {
          console.error('Erro ao atualizar log:', updateError);
          throw updateError;
        }
      } else {
        const { error: insertError } = await supabase.from('exercise_logs').insert({
          client_id: profile!.id,
          exercise_id: exerciseId,
          daily_workout_id: exercise.daily_workout_id,
          date: today,
          sets_completed: setsToSave,
        });

        if (insertError) {
          console.error('Erro ao inserir log:', insertError);
          throw insertError;
        }
      }

      setExerciseLogs(prev => ({
        ...prev,
        [exerciseId]: {
          ...prev[exerciseId],
          saved: true,
        },
      }));

      // Remover do estado de auto-saving
      if (isAutoSave) {
        setAutoSaving(prev => {
          const newSet = new Set(prev);
          newSet.delete(exerciseId);
          return newSet;
        });
      }

      // Marcar como completo automaticamente se tiver dados
      const hasData = setsToSave.some(s => s.weight > 0 || s.reps > 0);
      if (hasData && !completedExercises.includes(exerciseId)) {
        toggleExercise(exerciseId);
      }
    } catch (error) {
      console.error('Erro ao salvar log:', error);
      // Remover do estado de auto-saving mesmo em caso de erro
      if (isAutoSave) {
        setAutoSaving(prev => {
          const newSet = new Set(prev);
          newSet.delete(exerciseId);
          return newSet;
        });
      }
    } finally {
      if (!isAutoSave) {
        setSavingExercise(null);
      }
    }
  }

  // Agendar auto-save com debounce
  function scheduleAutoSave(exerciseId: string) {
    // Cancelar timeout anterior se existir
    const existingTimeout = autoSaveTimeouts.current.get(exerciseId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Marcar como pendente de auto-save
    setAutoSaving(prev => new Set(prev).add(exerciseId));

    // Agendar novo auto-save em 2 segundos
    const timeout = setTimeout(() => {
      const exercise = exercises.find(e => e.id === exerciseId);
      if (exercise && exerciseLogsRef.current[exerciseId] && !exerciseLogsRef.current[exerciseId].saved) {
        saveExerciseLog(exerciseId, exercise, true);
      }
      autoSaveTimeouts.current.delete(exerciseId);
    }, 2000);

    autoSaveTimeouts.current.set(exerciseId, timeout);
  }

  // Limpar timeouts ao desmontar
  useEffect(() => {
    return () => {
      autoSaveTimeouts.current.forEach(timeout => clearTimeout(timeout));
      autoSaveTimeouts.current.clear();
    };
  }, []);

  // Restaurar sessão ativa ao montar / trocar de treino (cronômetro continua do início salvo)
  useEffect(() => {
    if (!workout?.id) {
      setSessionStart(null);
      return;
    }
    const raw = localStorage.getItem(sessionStorageKey(workout.id, currentDate));
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.startedAt) {
          setSessionStart(new Date(parsed.startedAt).getTime());
          return;
        }
      } catch {
        // ignora sessão corrompida
      }
    }
    setSessionStart(null);
  }, [workout?.id, currentDate]);

  // Cronômetro ao vivo enquanto a sessão estiver rodando
  useEffect(() => {
    if (sessionStart === null) {
      setElapsedSeconds(0);
      return;
    }
    const tick = () => setElapsedSeconds(Math.floor((Date.now() - sessionStart) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sessionStart]);

  function startWorkout() {
    if (!workout) return;
    const startedAt = new Date().toISOString();
    localStorage.setItem(
      sessionStorageKey(workout.id, currentDateRef.current),
      JSON.stringify({ startedAt })
    );
    setSessionStart(new Date(startedAt).getTime());

    // Abrir todos os exercícios para os campos de carga/reps já aparecerem prontos
    setExerciseLogs(prev => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        next[id] = { ...next[id], expanded: true };
      }
      return next;
    });
  }

  async function finishWorkout() {
    if (sessionStart === null || !workout) return;
    const durationMs = Date.now() - sessionStart;
    const today = currentDateRef.current;

    // Buscar a última sessão anterior (date < hoje) de cada exercício para comparação
    const previousByExercise = new Map<string, LoggedSet[]>();
    const exerciseIds = exercises.map((e) => e.id);
    if (exerciseIds.length > 0) {
      const { data: prevLogs } = await supabase
        .from('exercise_logs')
        .select('exercise_id, sets_completed, date')
        .eq('client_id', profile!.id)
        .in('exercise_id', exerciseIds)
        .lt('date', today)
        .order('date', { ascending: false });

      (prevLogs || []).forEach((log) => {
        if (!previousByExercise.has(log.exercise_id)) {
          previousByExercise.set(log.exercise_id, (log.sets_completed as LoggedSet[]) || []);
        }
      });
    }

    // Dados de hoje a partir do estado atual (ref evita stale closure)
    const todaySessions = exercises.map((e) => ({
      id: e.id,
      name: e.name,
      sets: (exerciseLogsRef.current[e.id]?.sets || []).map((s) => ({
        set: s.set,
        weight: parseFloat(s.weight) || 0,
        reps: parseFloat(s.reps) || 0,
      })),
    }));

    const highlights = computeWorkoutHighlights(todaySessions, previousByExercise);

    // Encerrar sessão. O resumo só aparece após a foto pós-treino obrigatória.
    localStorage.removeItem(sessionStorageKey(workout.id, today));
    setSessionStart(null);
    setPendingSummary({ durationMs, highlights });
    setShowWorkoutCamera(true);
  }

  // Foto pós-treino obrigatória (câmera in-app). Só libera o resumo após capturar.
  async function handleWorkoutPhotoCapture(blob: Blob, takenAt: Date) {
    if (!profile?.id) return;
    setUploadingPhoto(true);
    const today = currentDateRef.current;
    try {
      const photo = await uploadCheckinPhoto({
        clientId: profile.id,
        date: today,
        type: 'workout',
        blob,
        takenAt,
        activityType: workout?.workout_type ?? null,
      });
      if (photo) {
        setShowWorkoutCamera(false);
        setSummary(pendingSummary);
        setPendingSummary(null);
      } else {
        alert('Não foi possível salvar a foto. Tente novamente.');
      }
    } finally {
      setUploadingPhoto(false);
    }
  }

  function closeSummary() {
    setSummary(null);
  }

  const selectedWeekday = WEEKDAYS[selectedDay];

  return (
    <PageContainer>
      <Header
        title="Meus Treinos"
        subtitle={selectedWeekday.full}
        showBack
      >
        <div className={styles.daysNav}>
          <div className={styles.days}>
            {WEEKDAYS.map((day) => (
              <button
                key={day.index}
                className={`${styles.dayButton} ${selectedDay === day.index ? styles.active : ''}`}
                onClick={() => setSelectedDay(day.index)}
              >
                <span className={styles.dayName}>{day.short}</span>
                {selectedDay === day.index && <span className={styles.dayIndicator} />}
              </button>
            ))}
          </div>
        </div>
      </Header>

      <main className={styles.content}>
        {loading ? (
          <div className={styles.loading}>Carregando treino...</div>
        ) : workout ? (
          <>
            <Card className={styles.workoutInfo}>
              <div className={styles.workoutIcon}>
                <span>💪</span>
              </div>
              <div className={styles.workoutDetails}>
                <h2 className={styles.workoutTitle}>Treino de {selectedWeekday.full}</h2>
                <p className={styles.workoutSubtitle}>
                  {workout.workout_type || 'Treino'} • {completedExercises.length}/{exercises.length} exercicios
                </p>
              </div>
            </Card>

            <div className={styles.sessionBar}>
              {sessionStart === null ? (
                <button className={styles.startBtn} onClick={startWorkout}>
                  <Play size={18} fill="currentColor" /> Iniciar treino
                </button>
              ) : (
                <>
                  <div className={styles.timerDisplay}>
                    <Clock size={18} />
                    <span>{formatTimer(elapsedSeconds)}</span>
                  </div>
                  <button className={styles.finishBtn} onClick={finishWorkout}>
                    <Square size={16} fill="currentColor" /> Finalizar
                  </button>
                </>
              )}
            </div>

            <div className={styles.exerciseList}>
              {exercises.map((exercise, index) => {
                const isCompleted = completedExercises.includes(exercise.id);
                const log = exerciseLogs[exercise.id];
                const isExpanded = log?.expanded;

                return (
                  <Card key={exercise.id} className={styles.exerciseCard}>
                    <div className={styles.exerciseMain}>
                      <div className={styles.exerciseLeft}>
                        <div className={`${styles.line} ${index === exercises.length - 1 ? styles.lastLine : ''}`} />
                        <Checkbox
                          checked={isCompleted}
                          onChange={() => toggleExercise(exercise.id)}
                        />
                      </div>
                      <div className={styles.exerciseContent} onClick={() => toggleExpand(exercise.id)}>
                        <h3 className={`${styles.exerciseName} ${isCompleted ? styles.completed : ''}`}>
                          {exercise.name}
                        </h3>
                        <p className={styles.exerciseDetails}>
                          {exercise.sets} series • {exercise.reps} reps
                          {exercise.rest && ` • ${formatRestTime(exercise.rest)} desc`}
                          {exercise.weight_kg && ` • ${exercise.weight_kg}kg`}
                        </p>
                        {exercise.notes && (
                          <p className={styles.exerciseNotes}>{exercise.notes}</p>
                        )}
                        <TechniqueBadge
                          techniqueId={exercise.technique_id}
                          effortParameterId={exercise.effort_parameter_id}
                        />
                      </div>
                      <div className={styles.exerciseActions}>
                        {exercise.video_url && (
                          <YouTubeEmbed
                            url={exercise.video_url}
                            title={exercise.name}
                          />
                        )}
                        <button
                          className={styles.expandButton}
                          onClick={() => toggleExpand(exercise.id)}
                          aria-label={isExpanded ? 'Recolher' : 'Registrar carga'}
                        >
                          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                      </div>
                    </div>

                    {/* Seção de Log Expandida */}
                    {isExpanded && log && (
                      <div className={styles.logSection}>
                        <div className={styles.logHeader}>
                          <span>Serie</span>
                          <span>Peso (kg)</span>
                          <span>Reps</span>
                        </div>

                        {log.sets.map((set, setIndex) => (
                          <div key={setIndex} className={styles.logRow}>
                            <span className={styles.setNumber}>{set.set}</span>
                            <input
                              type="number"
                              step="0.5"
                              placeholder="kg"
                              value={set.weight}
                              onChange={(e) => updateSet(exercise.id, setIndex, 'weight', e.target.value)}
                              className={styles.logInput}
                            />
                            <input
                              type="number"
                              placeholder="reps"
                              value={set.reps}
                              onChange={(e) => updateSet(exercise.id, setIndex, 'reps', e.target.value)}
                              className={styles.logInput}
                            />
                          </div>
                        ))}

                        <div className={styles.logActions}>
                          <div className={styles.setButtons}>
                            <button
                              className={styles.setBtn}
                              onClick={() => removeSet(exercise.id)}
                              disabled={log.sets.length <= 1}
                            >
                              <Minus size={16} />
                            </button>
                            <button
                              className={styles.setBtn}
                              onClick={() => addSet(exercise.id)}
                            >
                              <Plus size={16} />
                            </button>
                          </div>

                          <button
                            className={`${styles.saveBtn} ${log.saved ? styles.saved : ''} ${autoSaving.has(exercise.id) ? styles.autoSaving : ''}`}
                            onClick={() => saveExerciseLog(exercise.id, exercise)}
                            disabled={savingExercise === exercise.id || autoSaving.has(exercise.id)}
                          >
                            {savingExercise === exercise.id || autoSaving.has(exercise.id) ? (
                              'Salvando...'
                            ) : log.saved ? (
                              <>
                                <Check size={16} />
                                Salvo
                              </>
                            ) : (
                              'Salvar'
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </>
        ) : (
          <div className={styles.emptyState}>
            <p>Nenhum treino para este dia</p>
          </div>
        )}
      </main>

      <BottomNav />

      {/* Câmera pós-treino OBRIGATÓRIA: sem onCancel, não fecha sem capturar */}
      <CameraCapture
        isOpen={showWorkoutCamera}
        title="Foto pós-treino"
        subtitle="Registre sua foto para validar o treino"
        uploading={uploadingPhoto}
        onCapture={handleWorkoutPhotoCapture}
      />

      {summary && (
        <WorkoutSummaryModal
          durationMs={summary.durationMs}
          highlights={summary.highlights}
          onClose={closeSummary}
        />
      )}
    </PageContainer>
  );
}
