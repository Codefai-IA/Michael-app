import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Dumbbell, Utensils, Loader2, Crown, Medal } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { getPageCache, setPageCache } from '../../lib/pageCache';
import { Card, AvatarImage } from '../ui';
import type { MonthlyPoints, RankingEntry } from '../../types/database';
import { useI18n } from '../../i18n';
import type { Locale } from '../../types/database';
import styles from './RankingTab.module.css';

function getBrasiliaDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function getBrasiliaDay(): number {
  return Number(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    day: 'numeric'
  }).format(new Date()));
}

function getMonthName(yearMonth: string, locale: Locale): string {
  const [year, month] = yearMonth.split('-');
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

function getPreviousYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const prevDate = new Date(year, month - 2);
  const prevYear = prevDate.getFullYear();
  const prevMonth = String(prevDate.getMonth() + 1).padStart(2, '0');
  return `${prevYear}-${prevMonth}`;
}

// Ícones de pódio (1º coroa, 2º/3º medalha) com cores ouro/prata/bronze
const MEDAL_ICONS = [Crown, Medal, Medal];
const MEDAL_COLORS = ['#eab308', '#94a3b8', '#b45309'];

function Podium({
  entries,
  label,
  onSelect,
}: {
  entries: RankingEntry[];
  label?: string;
  onSelect: (clientId: string) => void;
}) {
  if (entries.length === 0) return null;

  // Reorder: [2nd, 1st, 3rd] for visual layout
  const ordered: (RankingEntry | null)[] = [
    entries[1] || null,
    entries[0],
    entries[2] || null,
  ];

  const placeIndex = [1, 0, 2]; // maps ordered position to actual place

  return (
    <div className={styles.podium}>
      {label && <span className={styles.podiumLabel}>{label}</span>}
      <div className={styles.podiumRow}>
        {ordered.map((entry, i) => {
          if (!entry) return <div key={`empty-${i}`} className={styles.podiumSlot} />;
          const place = placeIndex[i];
          return (
            <div
              key={entry.id}
              className={`${styles.podiumSlot} ${place === 0 ? styles.podiumSlotFirst : ''}`}
            >
              <div className={`${styles.podiumAvatarWrap} ${styles[`podiumPlace${place}`]}`}>
                <div className={styles.podiumAvatar}>
                  {entry.profiles.photo_url ? (
                    <AvatarImage src={entry.profiles.photo_url} />
                  ) : (
                    <span>{entry.profiles.full_name?.charAt(0) || '?'}</span>
                  )}
                </div>
                <span className={styles.podiumMedal}>
                  {(() => {
                    const MedalIcon = MEDAL_ICONS[place];
                    return <MedalIcon size={place === 0 ? 22 : 18} color={MEDAL_COLORS[place]} fill={MEDAL_COLORS[place]} />;
                  })()}
                </span>
              </div>
              <button
                className={styles.podiumNameBtn}
                onClick={() => onSelect(entry.client_id)}
              >
                {entry.profiles.full_name?.split(' ')[0]}
              </button>
              <span className={`${styles.podiumPoints} ${place === 0 ? styles.podiumPointsFirst : ''}`}>
                {entry.total_points} pts
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface RankingCache {
  ranking: RankingEntry[];
  lastMonthWinners: RankingEntry[];
  monthlyGift: string | null;
}

type RankingRow = MonthlyPoints & { full_name: string; photo_url: string | null };

const toEntry = ({ full_name, photo_url, ...row }: RankingRow): RankingEntry => ({
  ...row,
  profiles: { full_name, photo_url },
});

async function fetchRankingFallback(
  yearMonth: string,
  previousYearMonth: string
): Promise<[RankingEntry[] | null, RankingEntry[] | null]> {
  const [currentResult, lastMonthResult] = await Promise.all([
    supabase.from('monthly_points').select('*').eq('year_month', yearMonth).order('total_points', { ascending: false }),
    supabase.from('monthly_points').select('*').eq('year_month', previousYearMonth).order('total_points', { ascending: false }),
  ]);
  const current = (currentResult.data ?? []) as MonthlyPoints[];
  const lastMonth = (lastMonthResult.data ?? []) as MonthlyPoints[];
  const ids = [...new Set([...current, ...lastMonth].map((p) => p.client_id))];
  const { data: cards } = ids.length ? await supabase.rpc('get_member_cards', { p_ids: ids }) : { data: [] };
  const cardById = new Map(
    ((cards ?? []) as { id: string; full_name: string; photo_url: string | null }[]).map((c) => [c.id, c])
  );
  const withCards = (rows: MonthlyPoints[]): RankingEntry[] =>
    rows.flatMap((row) => {
      const card = cardById.get(row.client_id);
      return card ? [{ ...row, profiles: { full_name: card.full_name, photo_url: card.photo_url } }] : [];
    });
  return [
    currentResult.error ? null : withCards(current),
    lastMonthResult.error ? null : withCards(lastMonth).slice(0, 3),
  ];
}

export function RankingTab() {
  const { t, tc, locale } = useI18n();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const openCalendar = (clientId: string) => navigate(`/app/aluno/${clientId}/calendario`);
  const today = getBrasiliaDate();
  const yearMonth = today.substring(0, 7);
  const previousYearMonth = getPreviousYearMonth(yearMonth);
  const cacheKey = `ranking:${profile?.id}:${yearMonth}`;
  const cached = getPageCache<RankingCache>(cacheKey);

  const [ranking, setRanking] = useState<RankingEntry[]>(cached?.ranking ?? []);
  const [lastMonthWinners, setLastMonthWinners] = useState<RankingEntry[]>(cached?.lastMonthWinners ?? []);
  const [monthlyGift, setMonthlyGift] = useState<string | null>(cached?.monthlyGift ?? null);
  // Reabrindo a aba: mostra o ultimo ranking na hora e atualiza por tras
  const [loading, setLoading] = useState(!cached);
  const dayOfMonth = getBrasiliaDay();
  const isFirstDay = dayOfMonth === 1;
  // Ranking starts in March 2026, so only show last month's winner from April onwards
  const showLastMonthWinner = previousYearMonth >= '2026-03';

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      // Pontos + nome/foto numa unica viagem (get_ranking). O aluno nao le o perfil dos outros
      // (e-mail, telefone, peso): o RPC devolve so nome e foto e ja deixa o low ticket de fora.
      const [currentResult, lastMonthResult, settingsResult] = await Promise.all([
        supabase.rpc('get_ranking', { p_year_month: yearMonth }),
        supabase.rpc('get_ranking', { p_year_month: previousYearMonth, p_limit: 3 }),
        supabase
          .from('app_settings')
          .select('ranking_monthly_gift')
          .limit(1)
          .maybeSingle(),
      ]);

      let current: RankingEntry[] | null = null;
      let lastMonth: RankingEntry[] | null = null;
      if (!currentResult.error && !lastMonthResult.error) {
        current = ((currentResult.data ?? []) as RankingRow[]).map(toEntry);
        lastMonth = ((lastMonthResult.data ?? []) as RankingRow[]).map(toEntry);
      } else {
        // get_ranking ainda nao existe no banco: caminho anterior (pontos + get_member_cards)
        [current, lastMonth] = await fetchRankingFallback(yearMonth, previousYearMonth);
      }

      const gift = settingsResult.data?.ranking_monthly_gift ?? null;
      if (current) setRanking(current);
      if (lastMonth) setLastMonthWinners(lastMonth);
      if (gift) setMonthlyGift(gift);
      if (current && lastMonth) {
        setPageCache<RankingCache>(cacheKey, { ranking: current, lastMonthWinners: lastMonth, monthlyGift: gift });
      }
    } catch (err) {
      console.error('Error fetching ranking:', err);
    } finally {
      setLoading(false);
    }
  }

  const top3 = ranking.slice(0, 3);
  const restRanking = ranking.slice(3);
  const myPosition = ranking.findIndex(r => r.client_id === profile?.id);
  const myEntry = myPosition >= 0 ? ranking[myPosition] : null;

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <Loader2 size={32} className={styles.spinning} />
        <p>{t('rankingTab.loading')}</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Prize Banner - Top */}
      {monthlyGift && (
        <div className={styles.prizeBanner}>
          <span className={styles.prizeBannerIcon}><Trophy size={22} /></span>
          <div className={styles.prizeBannerText}>
            <strong>{t('rankingTab.prizeLabel')}</strong>
            <span>{tc('notice', monthlyGift)}</span>
          </div>
        </div>
      )}

      {/* Last Month Winner Banner - only from April 2026 onwards */}
      {showLastMonthWinner && lastMonthWinners.length > 0 && lastMonthWinners[0] && (
        <div className={styles.winnerBanner}>
          <div className={styles.winnerBannerAvatar}>
            {lastMonthWinners[0].profiles.photo_url ? (
              <AvatarImage src={lastMonthWinners[0].profiles.photo_url} />
            ) : (
              <span>{lastMonthWinners[0].profiles.full_name?.charAt(0) || '?'}</span>
            )}
          </div>
          <div className={styles.winnerBannerInfo}>
            <span className={styles.winnerBannerLabel}>
              {isFirstDay
                ? t('rankingTab.championOfMonth')
                : t('rankingTab.championOf', { month: getMonthName(previousYearMonth, locale) })}
            </span>
            <span className={styles.winnerBannerName}>
              {lastMonthWinners[0].profiles.full_name} - {lastMonthWinners[0].total_points} pts
            </span>
          </div>
          <span className={styles.winnerBannerTrophy}><Trophy size={24} /></span>
        </div>
      )}

      {/* Current Month Header */}
      <div className={styles.monthHeader}>
        <Trophy size={24} className={styles.trophyIcon} />
        <h2 className={styles.monthTitle}>{getMonthName(yearMonth, locale)}</h2>
      </div>

      {/* Current Month Podium - Top 3 */}
      {top3.length > 0 && (
        <Podium entries={top3} onSelect={openCalendar} />
      )}

      {/* My Stats Card */}
      {myEntry ? (
        <Card className={styles.myStatsCard}>
          <div className={styles.myPosition}>
            <span className={styles.positionNumber}>#{myPosition + 1}</span>
            <span className={styles.positionLabel}>{t('rankingTab.myPosition')}</span>
          </div>
          <div className={styles.myPoints}>
            <span className={styles.pointsNumber}>{myEntry.total_points}</span>
            <span className={styles.pointsLabel}>{t('rankingTab.points')}</span>
          </div>
          <div className={styles.myBreakdown}>
            <div className={styles.breakdownItem}>
              <Dumbbell size={14} />
              <span>{t('rankingTab.workoutDays', { count: myEntry.days_with_workout })}</span>
            </div>
            <div className={styles.breakdownItem}>
              <Utensils size={14} />
              <span>{t('rankingTab.dietDays', { count: myEntry.days_with_diet })}</span>
            </div>
          </div>
        </Card>
      ) : (
        <Card className={styles.myStatsCard}>
          <p className={styles.noPointsYet}>
            {t('rankingTab.noPointsYet')}
          </p>
        </Card>
      )}

      {/* Remaining Leaderboard (4th place and below) */}
      {restRanking.length > 0 && (
        <div className={styles.leaderboard}>
          <h3 className={styles.leaderboardTitle}>{t('rankingTab.leaderboard')}</h3>
          <div className={styles.rankingList}>
            {restRanking.map((entry, index) => {
              const actualPosition = index + 4;
              const isMe = entry.client_id === profile?.id;

              return (
                <Card
                  key={entry.id}
                  className={`${styles.rankingItem} ${isMe ? styles.rankingItemMe : ''}`}
                >
                  <div className={styles.rankPosition}>
                    <span className={styles.positionNum}>{actualPosition}</span>
                  </div>

                  <div className={styles.rankAvatar}>
                    {entry.profiles.photo_url ? (
                      <AvatarImage src={entry.profiles.photo_url} />
                    ) : (
                      <span>{entry.profiles.full_name?.charAt(0) || '?'}</span>
                    )}
                  </div>

                  <div className={styles.rankInfo}>
                    <button
                      className={styles.rankNameBtn}
                      onClick={() => openCalendar(entry.client_id)}
                    >
                      {entry.profiles.full_name}
                      {isMe && <span className={styles.youBadge}>{t('rankingTab.you')}</span>}
                    </button>
                    <span className={styles.rankDetails}>
                      {entry.days_with_workout}d treino / {entry.days_with_diet}d dieta
                    </span>
                  </div>

                  <div className={styles.rankPoints}>
                    <span className={styles.rankPointsValue}>{entry.total_points}</span>
                    <span className={styles.rankPointsLabel}>{t('rankingTab.pts')}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {ranking.length === 0 && (
        <Card className={styles.emptyState}>
          <Trophy size={40} className={styles.emptyIcon} />
          <p>{t('rankingTab.empty')}</p>
          <p className={styles.emptyHint}>{t('rankingTab.emptyHint')}</p>
        </Card>
      )}
    </div>
  );
}
