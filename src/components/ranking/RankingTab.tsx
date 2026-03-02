import { useEffect, useState } from 'react';
import { Trophy, Dumbbell, Utensils, Loader2, Award, Star } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Card } from '../ui';
import type { RankingEntry } from '../../types/database';
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

function getMonthName(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function getPreviousYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const prevDate = new Date(year, month - 2);
  const prevYear = prevDate.getFullYear();
  const prevMonth = String(prevDate.getMonth() + 1).padStart(2, '0');
  return `${prevYear}-${prevMonth}`;
}

const MEDAL_EMOJIS = ['🥇', '🥈', '🥉'];

function Podium({ entries, label }: { entries: RankingEntry[]; label?: string }) {
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
                    <img src={entry.profiles.photo_url} alt="" />
                  ) : (
                    <span>{entry.profiles.full_name?.charAt(0) || '?'}</span>
                  )}
                </div>
                <span className={styles.podiumMedal}>{MEDAL_EMOJIS[place]}</span>
              </div>
              <span className={styles.podiumName}>
                {entry.profiles.full_name?.split(' ')[0]}
              </span>
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

export function RankingTab() {
  const { profile } = useAuth();
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [lastMonthWinners, setLastMonthWinners] = useState<RankingEntry[]>([]);
  const [monthlyGift, setMonthlyGift] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const today = getBrasiliaDate();
  const yearMonth = today.substring(0, 7);
  const previousYearMonth = getPreviousYearMonth(yearMonth);
  const dayOfMonth = getBrasiliaDay();
  const isFirstDay = dayOfMonth === 1;
  // Ranking starts in March 2026, so only show last month's winner from April onwards
  const showLastMonthWinner = previousYearMonth >= '2026-03';

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [currentResult, lastMonthResult, settingsResult] = await Promise.all([
        supabase
          .from('monthly_points')
          .select(`*, profiles!inner(full_name, photo_url)`)
          .eq('year_month', yearMonth)
          .order('total_points', { ascending: false }),
        supabase
          .from('monthly_points')
          .select(`*, profiles!inner(full_name, photo_url)`)
          .eq('year_month', previousYearMonth)
          .order('total_points', { ascending: false })
          .limit(3),
        supabase
          .from('app_settings')
          .select('ranking_monthly_gift')
          .limit(1)
          .maybeSingle(),
      ]);

      if (!currentResult.error) {
        setRanking((currentResult.data as RankingEntry[]) || []);
      }
      if (!lastMonthResult.error) {
        setLastMonthWinners((lastMonthResult.data as RankingEntry[]) || []);
      }
      if (settingsResult.data?.ranking_monthly_gift) {
        setMonthlyGift(settingsResult.data.ranking_monthly_gift);
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
        <p>Carregando ranking...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Last Month Winner Banner - only from April 2026 onwards */}
      {showLastMonthWinner && lastMonthWinners.length > 0 && lastMonthWinners[0] && (
        <div className={styles.winnerBanner}>
          <div className={styles.winnerBannerAvatar}>
            {lastMonthWinners[0].profiles.photo_url ? (
              <img src={lastMonthWinners[0].profiles.photo_url} alt="" />
            ) : (
              <span>{lastMonthWinners[0].profiles.full_name?.charAt(0) || '?'}</span>
            )}
          </div>
          <div className={styles.winnerBannerInfo}>
            <span className={styles.winnerBannerLabel}>
              {isFirstDay ? 'Campeao do mes!' : `Campeao - ${getMonthName(previousYearMonth)}`}
            </span>
            <span className={styles.winnerBannerName}>
              {lastMonthWinners[0].profiles.full_name} - {lastMonthWinners[0].total_points} pts
            </span>
          </div>
          <span className={styles.winnerBannerTrophy}>🏆</span>
        </div>
      )}

      {/* Current Month Header */}
      <div className={styles.monthHeader}>
        <Trophy size={24} className={styles.trophyIcon} />
        <h2 className={styles.monthTitle}>{getMonthName(yearMonth)}</h2>
      </div>

      {/* Current Month Podium - Top 3 */}
      {top3.length > 0 && (
        <Podium entries={top3} />
      )}

      {/* My Stats Card */}
      {myEntry ? (
        <Card className={styles.myStatsCard}>
          <div className={styles.myPosition}>
            <span className={styles.positionNumber}>#{myPosition + 1}</span>
            <span className={styles.positionLabel}>Sua posicao</span>
          </div>
          <div className={styles.myPoints}>
            <span className={styles.pointsNumber}>{myEntry.total_points}</span>
            <span className={styles.pointsLabel}>pontos</span>
          </div>
          <div className={styles.myBreakdown}>
            <div className={styles.breakdownItem}>
              <Dumbbell size={14} />
              <span>{myEntry.days_with_workout} dias de treino</span>
            </div>
            <div className={styles.breakdownItem}>
              <Utensils size={14} />
              <span>{myEntry.days_with_diet} dias de dieta</span>
            </div>
          </div>
        </Card>
      ) : (
        <Card className={styles.myStatsCard}>
          <p className={styles.noPointsYet}>
            Voce ainda nao pontuou este mes. Complete treinos e refeicoes para ganhar pontos!
          </p>
        </Card>
      )}

      {/* Remaining Leaderboard (4th place and below) */}
      {restRanking.length > 0 && (
        <div className={styles.leaderboard}>
          <h3 className={styles.leaderboardTitle}>Classificacao Geral</h3>
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
                      <img src={entry.profiles.photo_url} alt="" />
                    ) : (
                      <span>{entry.profiles.full_name?.charAt(0) || '?'}</span>
                    )}
                  </div>

                  <div className={styles.rankInfo}>
                    <span className={styles.rankName}>
                      {entry.profiles.full_name}
                      {isMe && <span className={styles.youBadge}>voce</span>}
                    </span>
                    <span className={styles.rankDetails}>
                      {entry.days_with_workout}d treino / {entry.days_with_diet}d dieta
                    </span>
                  </div>

                  <div className={styles.rankPoints}>
                    <span className={styles.rankPointsValue}>{entry.total_points}</span>
                    <span className={styles.rankPointsLabel}>pts</span>
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
          <p>Nenhum ponto registrado este mes.</p>
          <p className={styles.emptyHint}>Complete treinos e dietas para aparecer no ranking!</p>
        </Card>
      )}

      {/* Prize Info */}
      <div className={styles.prizeInfo}>
        <Trophy size={16} />
        <span>{monthlyGift ? <>1° lugar ganha: <strong>{monthlyGift}</strong></> : '1° lugar ganha um premio no final do mes!'}</span>
      </div>
    </div>
  );
}
