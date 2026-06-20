import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Bike,
  Footprints,
  Activity,
  Utensils,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { PageContainer, Header, BottomNav } from '../../components/layout';
import { Modal, StampedImage, formatStamp } from '../../components/ui';
import { getCheckinPhotoUrl } from '../../lib/checkinPhotos';
import type { CalendarDay, CalendarPhoto } from '../../types/database';
import styles from './ActivityCalendar.module.css';

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function getBrasiliaYearMonth(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date());
}

function monthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y, m - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function shiftMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Ícone vermelho por tipo de treino concluído
function ActivityIcon({ type }: { type: string }) {
  const t = type.toLowerCase();
  if (t.includes('corrida') || t.includes('run') || t.includes('caminhada')) {
    return <Footprints size={12} />;
  }
  if (t.includes('bike') || t.includes('ciclis') || t.includes('bicicleta')) {
    return <Bike size={12} />;
  }
  if (t.includes('musc') || t.includes('força') || t.includes('forca') || t.includes('peso')) {
    return <Dumbbell size={12} />;
  }
  return <Activity size={12} />;
}

export function ActivityCalendar() {
  const { profile } = useAuth();
  const { id } = useParams<{ id: string }>();

  // Modo terceiro: visualizando o calendário de outro participante do ranking
  const targetClientId = id ?? profile?.id ?? null;
  const isThirdParty = !!id && id !== profile?.id;

  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState(getBrasiliaYearMonth());
  const [days, setDays] = useState<Record<string, CalendarDay>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  const currentYearMonth = getBrasiliaYearMonth();
  const canGoNext = viewMonth < currentYearMonth;

  // Nome do dono (modo terceiro)
  useEffect(() => {
    if (!isThirdParty || !id) return;
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => setOwnerName(data?.full_name ?? null));
  }, [id, isThirdParty]);

  // Carregar calendário do mês via RPC
  useEffect(() => {
    let active = true;
    async function load() {
      if (!targetClientId) return;
      setLoading(true);
      const { data, error } = await supabase.rpc('get_user_calendar', {
        p_client_id: targetClientId,
        p_year_month: viewMonth,
      });
      if (!active) return;
      if (error) {
        console.error('Erro ao carregar calendário:', error);
        setDays({});
      } else {
        const map: Record<string, CalendarDay> = {};
        (data as CalendarDay[]).forEach((d) => {
          map[d.date] = d;
        });
        setDays(map);
      }
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [targetClientId, viewMonth]);

  // Estrutura do grid do mês
  const cells = useMemo(() => {
    const [y, m] = viewMonth.split('-').map(Number);
    const firstWeekday = new Date(y, m - 1, 1).getDay();
    const daysInMonth = new Date(y, m, 0).getDate();
    const out: (string | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      out.push(`${viewMonth}-${String(d).padStart(2, '0')}`);
    }
    return out;
  }, [viewMonth]);

  const title = isThirdParty ? (ownerName ?? 'Calendário') : 'Meu Calendário';
  const subtitle = isThirdParty ? 'Atividades dos últimos 30 dias' : 'Histórico de atividades';

  return (
    <PageContainer hasBottomNav={!isThirdParty}>
      <Header title={title} subtitle={subtitle} showBack={isThirdParty} />

      <main className={styles.main}>
        {/* Navegação de mês */}
        <div className={styles.monthNav}>
          <button
            className={styles.navBtn}
            onClick={() => setViewMonth((v) => shiftMonth(v, -1))}
            aria-label="Mês anterior"
          >
            <ChevronLeft size={20} />
          </button>
          <span className={styles.monthTitle}>{monthLabel(viewMonth)}</span>
          <button
            className={styles.navBtn}
            onClick={() => canGoNext && setViewMonth((v) => shiftMonth(v, 1))}
            disabled={!canGoNext}
            aria-label="Próximo mês"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Legenda */}
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.legendWorkout}`} /> Treino
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.legendDiet}`} /> Dieta
          </span>
        </div>

        {loading ? (
          <div className={styles.loadingState}>
            <Loader2 size={28} className={styles.spin} />
            <p>Carregando…</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {WEEKDAY_LABELS.map((w, i) => (
              <div key={`h-${i}`} className={styles.weekdayHead}>
                {w}
              </div>
            ))}
            {cells.map((date, i) => {
              if (!date) return <div key={`e-${i}`} className={styles.emptyCell} />;
              const day = days[date];
              const dayNum = Number(date.split('-')[2]);
              const photos = day?.photos ?? [];
              const hasData = !!day && (day.has_workout || day.has_diet || photos.length > 0);

              return (
                <button
                  key={date}
                  className={`${styles.cell} ${hasData ? styles.cellActive : ''}`}
                  onClick={() => hasData && setSelectedDay(day)}
                  disabled={!hasData}
                >
                  <span className={styles.cellNum}>{dayNum}</span>

                  {/* Ícones vermelhos por tipo de treino */}
                  {day && day.activity_types.length > 0 && (
                    <span className={styles.activityIcons}>
                      {day.activity_types.slice(0, 2).map((t, idx) => (
                        <span key={idx} className={styles.activityIcon}>
                          <ActivityIcon type={t} />
                        </span>
                      ))}
                    </span>
                  )}
                  {/* Treino sem tipo definido -> bolinha vermelha */}
                  {day && day.has_workout && day.activity_types.length === 0 && (
                    <span className={`${styles.dot} ${styles.dotWorkout}`} />
                  )}

                  {/* Miniaturas das fotos do dia */}
                  {photos.length > 0 && (
                    <span className={styles.thumbs}>
                      {photos.slice(0, 3).map((p) => (
                        <img
                          key={p.id}
                          src={getCheckinPhotoUrl(p.storage_path)}
                          alt=""
                          className={styles.thumb}
                          loading="lazy"
                        />
                      ))}
                    </span>
                  )}

                  {/* Indicador de dieta */}
                  {day && day.has_diet && (
                    <span className={`${styles.dot} ${styles.dotDiet}`} />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal de detalhe do dia */}
      <DayDetailModal day={selectedDay} onClose={() => setSelectedDay(null)} />

      {!isThirdParty && <BottomNav />}
    </PageContainer>
  );
}

function dayHeading(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

function DayDetailModal({ day, onClose }: { day: CalendarDay | null; onClose: () => void }) {
  if (!day) return null;

  const dietPhotos = day.photos.filter((p) => p.type === 'diet');
  const workoutPhotos = day.photos.filter((p) => p.type === 'workout');

  return (
    <Modal isOpen={!!day} onClose={onClose} title={dayHeading(day.date)}>
      <div className={styles.modalBody}>
        {/* Resumo do dia */}
        <div className={styles.summaryRow}>
          <span className={`${styles.badge} ${day.has_workout ? styles.badgeOn : ''}`}>
            <Dumbbell size={14} /> {day.has_workout ? 'Treino feito' : 'Sem treino'}
          </span>
          <span className={`${styles.badge} ${day.has_diet ? styles.badgeOn : ''}`}>
            <Utensils size={14} /> {day.has_diet ? 'Dieta cumprida' : 'Sem dieta'}
          </span>
        </div>

        {day.activity_types.length > 0 && (
          <p className={styles.activitiesLine}>
            Atividades: {day.activity_types.join(', ')}
          </p>
        )}

        {/* Fotos de treino */}
        {workoutPhotos.length > 0 && (
          <PhotoSection label="Treino" photos={workoutPhotos} />
        )}
        {/* Fotos de dieta */}
        {dietPhotos.length > 0 && (
          <PhotoSection label="Refeições" photos={dietPhotos} />
        )}

        {day.photos.length === 0 && (
          <p className={styles.noPhotos}>Nenhuma foto registrada neste dia.</p>
        )}
      </div>
    </Modal>
  );
}

function PhotoSection({ label, photos }: { label: string; photos: CalendarPhoto[] }) {
  return (
    <div className={styles.photoSection}>
      <h4 className={styles.photoSectionTitle}>{label}</h4>
      <div className={styles.photoGrid}>
        {photos.map((p) => (
          <div key={p.id} className={styles.photoItem}>
            <StampedImage
              src={getCheckinPhotoUrl(p.storage_path)}
              takenAt={p.taken_at}
              className={styles.photoStamped}
            />
            <span className={styles.photoTime}>{formatStamp(p.taken_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
