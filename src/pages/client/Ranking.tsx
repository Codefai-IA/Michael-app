import { PageContainer, BottomNav } from '../../components/layout';
import { RankingTab } from '../../components/ranking/RankingTab';
import { useI18n } from '../../i18n';
import styles from './Ranking.module.css';

export function Ranking() {
  const { t } = useI18n();

  return (
    <PageContainer>
      <header className={styles.header}>
        <img
          src="/logo-icon.png"
          alt={t('ranking.logoAlt')}
          className={styles.logo}
        />
        <h1 className={styles.title}>{t('ranking.title')}</h1>
        <p className={styles.subtitle}>{t('ranking.subtitle')}</p>
      </header>

      <main className={styles.content}>
        <RankingTab />
      </main>

      <BottomNav />
    </PageContainer>
  );
}
