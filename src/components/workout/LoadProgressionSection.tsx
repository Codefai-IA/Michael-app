import { useState } from 'react';
import { ChevronDown, ChevronUp, LineChart, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../i18n';
import { Card } from '../ui';
import { formatNumber, weightUnitLabel } from '../../utils/units';
import { getBrasiliaDate } from '../../utils/planStatus';
import { buildProgression, progressionStartDate, type ProgressionLog } from '../../utils/loadProgression';
import type { Exercise, Locale } from '../../types/database';
import styles from './LoadProgressionSection.module.css';

const PAGE_SIZE = 1000; // limite padrao de linhas do PostgREST
const ID_CHUNK = 100; // mantem a URL do .in() curta
const SESSIONS_PREVIEW = 6;

interface LoadedData {
  logs: ProgressionLog[];
  nameById: Map<string, string>;
}

/** Carga como o aluno digitou: sem casas quando redonda, ate 2 quando precisa (ex.: 42,25). */
function formatValue(value: number, locale: Locale): string {
  const digits = Number.isInteger(value) ? 0 : Number.isInteger(value * 10) ? 1 : 2;
  return formatNumber(value, locale, digits);
}

/** dd/mm (pt-BR) ou mm/dd (en). Chave YYYY-MM-DD lida em UTC para nao mudar de dia pelo fuso. */
function formatShortDate(date: string, locale: Locale): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  });
}

async function fetchProgressionData(clientId: string, today: string): Promise<LoadedData> {
  const start = progressionStartDate(today);
  const logs: ProgressionLog[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('exercise_logs')
      .select('exercise_id, date, sets_completed')
      .eq('client_id', clientId)
      .gte('date', start)
      .order('date', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    logs.push(...((data || []) as ProgressionLog[]));
    if (!data || data.length < PAGE_SIZE) break;
  }

  // Nome de cada exercicio dos logs: e por ele que o historico sobrevive a um template reaplicado.
  const ids = [...new Set(logs.map((l) => l.exercise_id))];
  const nameById = new Map<string, string>();
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const { data, error } = await supabase
      .from('exercises')
      .select('id, name')
      .in('id', ids.slice(i, i + ID_CHUNK));
    if (error) throw error;
    (data || []).forEach((e) => nameById.set(e.id, e.name));
  }

  return { logs, nameById };
}

interface Props {
  clientId: string;
  /** Exercicios do dia selecionado na aba Treino. */
  exercises: Exercise[];
}

export function LoadProgressionSection({ clientId, exercises }: Props) {
  const { t, tc, locale, unitSystem } = useI18n();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [data, setData] = useState<LoadedData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const unit = weightUnitLabel(unitSystem);
  const today = getBrasiliaDate();

  // Busca a cada abertura: assim aparecem as cargas que o aluno acabou de salvar.
  async function load() {
    setLoading(true);
    setError(false);
    try {
      setData(await fetchProgressionData(clientId, today));
    } catch (err) {
      console.error('Erro ao carregar progressao de carga:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) load();
  }

  const progressionOf = (exercise: Exercise) =>
    data ? buildProgression(data.logs, data.nameById, exercise, today) : null;

  // Padrao: o primeiro exercicio do dia que ja tem historico.
  const target =
    exercises.find((e) => e.id === selectedId) ??
    exercises.find((e) => (progressionOf(e)?.sessions.length ?? 0) > 0) ??
    exercises[0];
  const progression = target ? progressionOf(target) : null;
  const hasAnyHistory = !!data && exercises.some((e) => (progressionOf(e)?.sessions.length ?? 0) > 0);

  const chartData = (progression?.weekly ?? []).map((w) => ({
    label: formatShortDate(w.weekStart, locale),
    maxWeight: w.maxWeight,
  }));
  const sessions = progression?.sessions ?? [];
  const visibleSessions = showAll ? sessions : sessions.slice(0, SESSIONS_PREVIEW);

  const latest = progression?.latest ?? null;
  const previous = progression?.previous ?? null;
  // Arredonda para nao exibir ruido de ponto flutuante (40,2 - 40 = 0,2000000000000028).
  const delta = latest && previous ? Math.round((latest.maxWeight - previous.maxWeight) * 100) / 100 : null;

  return (
    <section className={styles.section}>
      <button type="button" className={styles.toggle} onClick={toggle} aria-expanded={open}>
        <span className={styles.toggleIcon}>
          <LineChart size={20} />
        </span>
        <span className={styles.toggleText}>
          <span className={styles.toggleTitle}>{t('loadProgression.title')}</span>
          <span className={styles.toggleSubtitle}>{t('loadProgression.subtitle')}</span>
        </span>
        {open ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {open && (
        <div className={styles.body}>
          {loading && !data ? (
            <Card className={styles.stateCard}>{t('loadProgression.loading')}</Card>
          ) : error ? (
            <Card className={styles.stateCard}>
              <p className={styles.stateText}>{t('loadProgression.error')}</p>
              <button type="button" className={styles.linkButton} onClick={load}>
                {t('common.tryAgain')}
              </button>
            </Card>
          ) : !hasAnyHistory ? (
            <Card className={styles.stateCard}>
              <p className={styles.stateText}>{t('loadProgression.empty')}</p>
            </Card>
          ) : (
            target && (
              <>
                <Card className={styles.selectorCard}>
                  <label className={styles.selectorLabel} htmlFor="load-progression-exercise">
                    {t('loadProgression.exercise')}
                  </label>
                  <select
                    id="load-progression-exercise"
                    value={target.id}
                    onChange={(e) => {
                      setSelectedId(e.target.value);
                      setShowAll(false);
                    }}
                    className={styles.exerciseSelect}
                  >
                    {exercises.map((e) => (
                      <option key={e.id} value={e.id}>
                        {tc('exercise', e.name)}
                      </option>
                    ))}
                  </select>
                </Card>

                {latest && (
                  <Card className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>
                      {t('loadProgression.latest', { date: formatShortDate(latest.weekStart, locale) })}
                    </span>
                    <span className={styles.summaryValue}>
                      {formatValue(latest.maxWeight, locale)} {unit}
                    </span>
                    {delta === null ? (
                      <span className={`${styles.delta} ${styles.neutral}`}>
                        {t('loadProgression.firstWeek')}
                      </span>
                    ) : delta === 0 ? (
                      <span className={`${styles.delta} ${styles.neutral}`}>
                        <Minus size={14} /> {t('loadProgression.sameAsPrevious')}
                      </span>
                    ) : (
                      <span className={`${styles.delta} ${delta > 0 ? styles.up : styles.down}`}>
                        {delta > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {t('loadProgression.vsPrevious', {
                          delta: `${delta > 0 ? '+' : '−'}${formatValue(Math.abs(delta), locale)} ${unit}`,
                        })}
                      </span>
                    )}
                  </Card>
                )}

                <Card className={styles.chartCard}>
                  <h3 className={styles.cardTitle}>{t('loadProgression.chartTitle')}</h3>
                  {chartData.length === 0 ? (
                    <div className={styles.chartEmpty}>
                      {sessions.length > 0 ? t('loadProgression.noLoad') : t('loadProgression.noHistory')}
                    </div>
                  ) : (
                    <div className={styles.chartContainer}>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                            tickLine={false}
                            axisLine={{ stroke: 'var(--border-light)' }}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                            tickLine={false}
                            axisLine={{ stroke: 'var(--border-light)' }}
                            unit={unit}
                            width={52}
                          />
                          <Tooltip
                            cursor={{ fill: 'var(--primary-light)' }}
                            content={({ active, payload, label }) =>
                              active && payload?.length ? (
                                <div className={styles.tooltip}>
                                  <span className={styles.tooltipLabel}>
                                    {t('loadProgression.weekOf', { date: String(label) })}
                                  </span>
                                  <span className={styles.tooltipValue}>
                                    {formatValue(Number(payload[0].value), locale)} {unit}
                                  </span>
                                </div>
                              ) : null
                            }
                          />
                          <Bar dataKey="maxWeight" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Card>

                {sessions.length > 0 && (
                  <div className={styles.sessions}>
                    <h3 className={styles.cardTitle}>{t('loadProgression.historyTitle')}</h3>
                    {visibleSessions.map((session, i) => (
                      <Card key={`${session.date}-${i}`} className={styles.sessionCard}>
                        <div className={styles.sessionDate}>{formatShortDate(session.date, locale)}</div>
                        <div className={styles.setsList}>
                          {session.sets.map((set, j) => (
                            <div key={j} className={styles.setRow}>
                              <span className={styles.setNumber}>
                                {t('loadProgression.set', { n: set.set || j + 1 })}
                              </span>
                              <span className={styles.setDetails}>
                                {set.weight > 0 && (
                                  <>
                                    <span className={styles.setWeight}>
                                      {formatValue(set.weight, locale)} {unit}
                                    </span>
                                    <span className={styles.setSeparator}>×</span>
                                  </>
                                )}
                                <span className={styles.setReps}>
                                  {t('loadProgression.reps', { n: formatValue(set.reps, locale) })}
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </Card>
                    ))}
                    {sessions.length > SESSIONS_PREVIEW && (
                      <button type="button" className={styles.linkButton} onClick={() => setShowAll(!showAll)}>
                        {showAll
                          ? t('loadProgression.showLess')
                          : t('loadProgression.showAll', { count: sessions.length })}
                      </button>
                    )}
                  </div>
                )}
              </>
            )
          )}
        </div>
      )}
    </section>
  );
}
