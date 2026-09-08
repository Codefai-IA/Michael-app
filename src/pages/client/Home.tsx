import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Dumbbell, Utensils, ChevronRight, Flame } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { usePageData } from '../../hooks';
import { useI18n } from '../../i18n';
import { PageContainer, BottomNav } from '../../components/layout';
import { Card, ProgressBar, VideoCarousel, NoticeBoard } from '../../components/ui';
import type { DailyProgress } from '../../types/database';
import styles from './Home.module.css';

interface VideoItem {
  url: string;
  title: string;
}

interface HomeNotice {
  home_notice_title: string | null;
  home_notice_text: string | null;
  home_notice_active: boolean | null;
}

// Retorna a data atual no fuso horario de Brasilia
function getBrasiliaDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

export function Home() {
  const { profile } = useAuth();
  const { t, tc } = useI18n();
  const [progress, setProgress] = useState<DailyProgress | null>(null);
  const [weeklyStats, setWeeklyStats] = useState({ workouts: 0, meals: 0, totalWorkouts: 7, totalMeals: 7 });
  const [videoUrls, setVideoUrls] = useState<VideoItem[]>([]);
  const [notice, setNotice] = useState<HomeNotice | null>(null);

  const fetchAllData = useCallback(async () => {
    if (!profile?.id) return;

    const today = getBrasiliaDate();
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    // Buscar progresso de hoje, semanal e videos globais em paralelo
    const [todayResult, weekResult, settingsResult] = await Promise.all([
      supabase
        .from('daily_progress')
        .select('*')
        .eq('client_id', profile.id)
        .eq('date', today)
        .maybeSingle(),
      supabase
        .from('daily_progress')
        .select('*')
        .eq('client_id', profile.id)
        .gte('date', weekStart.toISOString().split('T')[0])
        .lte('date', today),
      supabase
        .from('app_settings')
        .select('home_video_urls, home_notice_title, home_notice_text, home_notice_active')
        .limit(1)
        .maybeSingle()
    ]);

    if (todayResult.data) {
      setProgress(todayResult.data);
    } else {
      setProgress(null);
    }

    if (weekResult.data) {
      const workouts = weekResult.data.filter(d => d.exercises_completed?.length > 0).length;
      const meals = weekResult.data.filter(d => d.meals_completed?.length > 0).length;
      setWeeklyStats({ workouts, meals, totalWorkouts: 7, totalMeals: 7 });
    }

    if (settingsResult.data?.home_video_urls) {
      setVideoUrls(settingsResult.data.home_video_urls as VideoItem[]);
    }

    setNotice(settingsResult.data ?? null);
  }, [profile?.id]);

  usePageData({
    userId: profile?.id,
    fetchData: fetchAllData,
  });

  const firstName = profile?.full_name?.split(' ')[0] || t('home.fallbackName');
  const weeklyPercentage = Math.round(
    ((weeklyStats.workouts + weeklyStats.meals) / (weeklyStats.totalWorkouts + weeklyStats.totalMeals)) * 100
  );

  return (
    <PageContainer>
      <header className={styles.header}>
        <div className={styles.greeting}>
          <h1 className={styles.title}>{t('home.greeting', { name: firstName })}</h1>
          <p className={styles.subtitle}>{t('home.subtitle')}</p>
        </div>
        <img
          src="/logo-icon.png"
          alt={t('home.logoAlt')}
          className={styles.logo}
        />
      </header>

      <main className={styles.content}>
        <NoticeBoard
          title={tc('notice', notice?.home_notice_title)}
          text={tc('notice', notice?.home_notice_text)}
          active={notice?.home_notice_active}
        />

        <Card variant="gradient" className={styles.progressCard}>
          <div className={styles.progressHeader}>
            <Flame size={20} />
            <span>{t('home.weeklyProgress')}</span>
          </div>
          <div className={styles.progressBarWrapper}>
            <ProgressBar value={weeklyPercentage} showLabel />
          </div>
          <p className={styles.progressStats}>
            {t('home.weeklyStats', {
              workouts: weeklyStats.workouts,
              totalWorkouts: weeklyStats.totalWorkouts,
              meals: weeklyStats.meals,
              totalMeals: weeklyStats.totalMeals,
            })}
          </p>
        </Card>

        <a href="https://www.instagram.com/michael.nutri/" target="_blank" rel="noopener noreferrer">
          <img
            src="/card4.png"
            alt={t('home.bannerAlt')}
            className={styles.bannerImage}
          />
        </a>

        <VideoCarousel
          videos={videoUrls.map((v) => ({ ...v, title: tc('notice', v.title) }))}
        />

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('home.today')}</h2>

          <Link to="/app/treino" className={styles.cardLink}>
            <Card hoverable className={styles.todayCard}>
              <div className={styles.cardIcon}>
                <Dumbbell size={24} />
              </div>
              <div className={styles.cardContent}>
                <h3 className={styles.cardTitle}>{t('home.workoutCard')}</h3>
                <p className={styles.cardSubtitle}>
                  {t('home.workoutDone', { count: progress?.exercises_completed.length || 0 })}
                </p>
                <div className={styles.cardProgress}>
                  <ProgressBar
                    value={progress?.exercises_completed.length || 0}
                    max={8}
                    size="sm"
                  />
                </div>
              </div>
              <ChevronRight size={20} className={styles.cardArrow} />
            </Card>
          </Link>

          <Link to="/app/dieta" className={styles.cardLink}>
            <Card hoverable className={styles.todayCard}>
              <div className={styles.cardIcon}>
                <Utensils size={24} />
              </div>
              <div className={styles.cardContent}>
                <h3 className={styles.cardTitle}>{t('home.dietCard')}</h3>
                <p className={styles.cardSubtitle}>
                  {t('home.dietDone', { count: progress?.meals_completed.length || 0 })}
                </p>
                <div className={styles.cardProgress}>
                  <ProgressBar
                    value={progress?.meals_completed.length || 0}
                    max={6}
                    size="sm"
                  />
                </div>
              </div>
              <ChevronRight size={20} className={styles.cardArrow} />
            </Card>
          </Link>
        </section>

      </main>

      <BottomNav />
    </PageContainer>
  );
}
