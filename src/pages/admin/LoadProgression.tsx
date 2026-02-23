import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Dumbbell } from 'lucide-react';
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import { supabase } from '../../lib/supabase';
import { PageContainer, Header } from '../../components/layout';
import { Card } from '../../components/ui';
import type { Profile, ExerciseLogSet } from '../../types/database';
import styles from './LoadProgression.module.css';

interface WeeklyDataPoint {
  weekLabel: string;
  weekStart: string;
  maxWeight: number;
}

interface SessionLog {
  date: string;
  dateLabel: string;
  sets: ExerciseLogSet[];
}

interface ExerciseOption {
  exerciseId: string;
  exerciseName: string;
  logCount: number;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

function formatWeekLabel(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return `${day}/${month}`;
}

function formatDateLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year.slice(2)}`;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <span className={styles.tooltipLabel}>Semana de {label}</span>
      <span className={styles.tooltipValue}>
        {payload[0].value}kg
      </span>
    </div>
  );
}

export function LoadProgression() {
  const { id } = useParams<{ id: string }>();

  const [client, setClient] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('');
  const [chartData, setChartData] = useState<WeeklyDataPoint[]>([]);
  const [sessionLogs, setSessionLogs] = useState<SessionLog[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);

  const fetchInitialData = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    const [clientResult, logsResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single(),
      supabase
        .from('exercise_logs')
        .select('exercise_id')
        .eq('client_id', id)
    ]);

    if (clientResult.data) setClient(clientResult.data);

    if (logsResult.data && logsResult.data.length > 0) {
      const exerciseIds = [...new Set(logsResult.data.map(l => l.exercise_id))];

      const countMap = new Map<string, number>();
      logsResult.data.forEach(l => {
        countMap.set(l.exercise_id, (countMap.get(l.exercise_id) || 0) + 1);
      });

      const { data: exercisesData } = await supabase
        .from('exercises')
        .select('id, name')
        .in('id', exerciseIds);

      if (exercisesData) {
        const options: ExerciseOption[] = exercisesData
          .map(e => ({
            exerciseId: e.id,
            exerciseName: e.name,
            logCount: countMap.get(e.id) || 0,
          }))
          .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));

        setExerciseOptions(options);

        if (options.length > 0) {
          setSelectedExerciseId(options[0].exerciseId);
        }
      }
    }

    setLoading(false);
  }, [id]);

  const fetchChartData = useCallback(async () => {
    if (!id || !selectedExerciseId) {
      setChartData([]);
      setSessionLogs([]);
      return;
    }

    setLoadingChart(true);

    const { data: logs } = await supabase
      .from('exercise_logs')
      .select('*')
      .eq('client_id', id)
      .eq('exercise_id', selectedExerciseId)
      .order('date', { ascending: true });

    if (!logs || logs.length === 0) {
      setChartData([]);
      setSessionLogs([]);
      setLoadingChart(false);
      return;
    }

    // Build weekly chart data
    const weekMap = new Map<string, number>();

    logs.forEach(log => {
      const date = new Date(log.date + 'T00:00:00');
      const monday = getMonday(date);
      const weekKey = monday.toISOString().split('T')[0];

      const sets: ExerciseLogSet[] = log.sets_completed || [];
      const sessionMaxWeight = sets.length > 0
        ? Math.max(...sets.map(s => s.weight || 0))
        : 0;

      const existing = weekMap.get(weekKey) || 0;
      weekMap.set(weekKey, Math.max(existing, sessionMaxWeight));
    });

    const data: WeeklyDataPoint[] = Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, maxWeight]) => ({
        weekLabel: formatWeekLabel(weekStart),
        weekStart,
        maxWeight,
      }));

    // Build session logs (most recent first)
    const sessions: SessionLog[] = [...logs]
      .reverse()
      .map(log => ({
        date: log.date,
        dateLabel: formatDateLabel(log.date),
        sets: (log.sets_completed || []) as ExerciseLogSet[],
      }));

    setChartData(data);
    setSessionLogs(sessions);
    setLoadingChart(false);
  }, [id, selectedExerciseId]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  return (
    <PageContainer hasBottomNav={false}>
      <Header
        title="Progressao de Cargas"
        subtitle={client?.full_name}
        showBack
      />

      <main className={styles.content}>
        {loading ? (
          <div className={styles.loading}>Carregando dados...</div>
        ) : exerciseOptions.length === 0 ? (
          <Card className={styles.emptyState}>
            <Dumbbell size={48} className={styles.emptyIcon} />
            <p className={styles.emptyText}>
              Nenhum exercicio registrado ainda
            </p>
            <p className={styles.emptySubtext}>
              O aluno precisa salvar cargas durante os treinos
              para que a progressao apareca aqui.
            </p>
          </Card>
        ) : (
          <>
            {/* Exercise Selector */}
            <Card className={styles.selectorCard}>
              <label className={styles.selectorLabel}>Exercicio</label>
              <select
                value={selectedExerciseId}
                onChange={(e) => setSelectedExerciseId(e.target.value)}
                className={styles.exerciseSelect}
              >
                {exerciseOptions.map(opt => (
                  <option key={opt.exerciseId} value={opt.exerciseId}>
                    {opt.exerciseName} ({opt.logCount} registros)
                  </option>
                ))}
              </select>
            </Card>

            {/* Bar Chart - Max Weight per Week */}
            <Card className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Carga Maxima por Semana</h3>

              {loadingChart ? (
                <div className={styles.chartLoading}>Carregando grafico...</div>
              ) : chartData.length === 0 ? (
                <div className={styles.chartEmpty}>Sem dados para este exercicio</div>
              ) : (
                <div className={styles.chartContainer}>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                      <XAxis
                        dataKey="weekLabel"
                        tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                        tickLine={false}
                        axisLine={{ stroke: 'var(--border-light)' }}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                        tickLine={false}
                        axisLine={{ stroke: 'var(--border-light)' }}
                        unit="kg"
                        width={55}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar
                        dataKey="maxWeight"
                        fill="var(--primary)"
                        radius={[4, 4, 0, 0]}
                        name="Carga Max (kg)"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            {/* Session History - Reps x Kg detail */}
            {sessionLogs.length > 0 && (
              <div className={styles.sessionsSection}>
                <h3 className={styles.sessionsTitle}>Historico de Series</h3>

                {sessionLogs.map((session, i) => (
                  <Card key={session.date + i} className={styles.sessionCard}>
                    <div className={styles.sessionDate}>{session.dateLabel}</div>
                    <div className={styles.setsList}>
                      {session.sets.map((set, j) => (
                        <div key={j} className={styles.setRow}>
                          <span className={styles.setNumber}>Serie {set.set}</span>
                          <div className={styles.setDetails}>
                            <span className={styles.setWeight}>{set.weight}kg</span>
                            <span className={styles.setSeparator}>x</span>
                            <span className={styles.setReps}>{set.reps} reps</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </PageContainer>
  );
}
