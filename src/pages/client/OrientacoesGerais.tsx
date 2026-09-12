import { useState, useCallback } from 'react';
import { Pill, FlaskConical, Utensils, FileText } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { getYoutubeId } from '../../lib/youtube';
import { usePageData } from '../../hooks';
import { useI18n } from '../../i18n';
import { PageContainer, Header, BottomNav } from '../../components/layout';
import { Card, VideoCarousel } from '../../components/ui';
import styles from './OrientacoesGerais.module.css';

interface Guidelines {
  recommended_supplements: string | null;
  manipulated_supplements: string | null;
  free_meal_video_url: string | null;
  general_notes: string | null;
  video_urls: Array<{url: string; title: string}> | null;
}

export function OrientacoesGerais() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const [guidelines, setGuidelines] = useState<Guidelines | null>(null);

  const loadGuidelines = useCallback(async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('patient_guidelines')
        .select('*')
        .eq('client_id', profile.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading guidelines:', error);
      }

      setGuidelines(data);
    } catch (err) {
      console.error('Error:', err);
    }
  }, [profile?.id]);

  const { isInitialLoading: loading } = usePageData({
    userId: profile?.id,
    fetchData: loadGuidelines,
  });

  const videoId = getYoutubeId(guidelines?.free_meal_video_url || '');

  if (loading) {
    return (
      <PageContainer>
        <Header title={t('guidelines.title')} subtitle={t('guidelines.subtitle')} showBack />
        <main className={styles.content}>
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
          <div className={styles.skeletonLarge} />
        </main>
        <BottomNav />
      </PageContainer>
    );
  }

  // Check if any content exists
  const hasContent = guidelines && (
    guidelines.recommended_supplements ||
    guidelines.manipulated_supplements ||
    guidelines.free_meal_video_url ||
    guidelines.general_notes ||
    (guidelines.video_urls && guidelines.video_urls.length > 0)
  );

  return (
    <PageContainer>
      <Header title={t('guidelines.title')} subtitle={t('guidelines.subtitle')} showBack />

      <main className={styles.content}>
        {!hasContent ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <FileText size={48} />
            </div>
            <p className={styles.emptyTitle}>{t('guidelines.emptyTitle')}</p>
            <p className={styles.emptySubtitle}>
              {t('guidelines.emptySubtitle')}
            </p>
          </div>
        ) : (
          <div className={styles.cardsContainer}>

            {/* Suplementos Recomendados */}
            {guidelines.recommended_supplements && (
              <Card className={styles.guidelineCard}>
                <div className={styles.cardHeader}>
                  <div className={`${styles.cardIcon} ${styles.supplements}`}>
                    <Pill size={24} />
                  </div>
                  <h2 className={styles.cardTitle}>{t('guidelines.supplements')}</h2>
                </div>
                <div className={`${styles.cardContent} ${styles.supplementsBg}`}>
                  <p className={styles.cardText}>
                    {guidelines.recommended_supplements}
                  </p>
                </div>
              </Card>
            )}

            {/* Manipulados */}
            {guidelines.manipulated_supplements && (
              <Card className={styles.guidelineCard}>
                <div className={styles.cardHeader}>
                  <div className={`${styles.cardIcon} ${styles.manipulated}`}>
                    <FlaskConical size={24} />
                  </div>
                  <h2 className={styles.cardTitle}>{t('guidelines.manipulated')}</h2>
                </div>
                <div className={`${styles.cardContent} ${styles.manipulatedBg}`}>
                  <p className={styles.cardText}>
                    {guidelines.manipulated_supplements}
                  </p>
                </div>
              </Card>
            )}

            {/* Video da Refeicao Livre */}
            {guidelines.free_meal_video_url && videoId && (
              <Card className={styles.guidelineCard}>
                <div className={styles.cardHeader}>
                  <div className={`${styles.cardIcon} ${styles.freeMeal}`}>
                    <Utensils size={24} />
                  </div>
                  <h2 className={styles.cardTitle}>{t('guidelines.freeMeal')}</h2>
                </div>
                <p className={styles.videoDescription}>
                  {t('guidelines.freeMealHint')}
                </p>
                <div className={styles.videoWrapper}>
                  <iframe
                    className={styles.videoFrame}
                    src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
                    title={t('guidelines.freeMealVideo')}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </Card>
            )}

            {/* Video Carousel */}
            {guidelines.video_urls && guidelines.video_urls.length > 0 && (
              <VideoCarousel videos={guidelines.video_urls} />
            )}

            {/* Observacoes Gerais */}
            {guidelines.general_notes && (
              <Card className={styles.guidelineCard}>
                <div className={styles.cardHeader}>
                  <div className={`${styles.cardIcon} ${styles.notes}`}>
                    <FileText size={24} />
                  </div>
                  <h2 className={styles.cardTitle}>{t('guidelines.notes')}</h2>
                </div>
                <div className={`${styles.cardContent} ${styles.notesBg}`}>
                  <p className={styles.cardText}>
                    {guidelines.general_notes}
                  </p>
                </div>
              </Card>
            )}

          </div>
        )}
      </main>

      <BottomNav />
    </PageContainer>
  );
}
