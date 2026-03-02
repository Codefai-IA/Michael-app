import { PageContainer, BottomNav } from '../../components/layout';
import { RankingTab } from '../../components/ranking/RankingTab';
import styles from './Ranking.module.css';

export function Ranking() {
  return (
    <PageContainer>
      <header className={styles.header}>
        <img
          src="/logo-icon.png"
          alt="Logo"
          className={styles.logo}
        />
        <h1 className={styles.title}>Ranking</h1>
        <p className={styles.subtitle}>Competicao mensal</p>
      </header>

      <main className={styles.content}>
        <RankingTab />
      </main>

      <BottomNav />
    </PageContainer>
  );
}
