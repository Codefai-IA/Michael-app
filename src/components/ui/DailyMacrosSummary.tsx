import { TrendingUp } from 'lucide-react';
import { ProgressBar } from './ProgressBar';
import { useI18n } from '../../i18n';
import styles from './DailyMacrosSummary.module.css';

interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

interface DailyMacrosSummaryProps {
  totalPlanned: MacroTotals;
  consumed: MacroTotals;
}

export function DailyMacrosSummary({ totalPlanned, consumed }: DailyMacrosSummaryProps) {
  const { t } = useI18n();
  const remaining = {
    calories: Math.max(0, totalPlanned.calories - consumed.calories),
    protein: Math.max(0, totalPlanned.protein - consumed.protein),
    carbs: Math.max(0, totalPlanned.carbs - consumed.carbs),
    fats: Math.max(0, totalPlanned.fats - consumed.fats),
  };

  const percentConsumed = totalPlanned.calories > 0
    ? Math.min(100, Math.round((consumed.calories / totalPlanned.calories) * 100))
    : 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <TrendingUp size={18} />
        <span>{t('macros.title')}</span>
      </div>

      <div className={styles.macrosGrid}>
        <div className={styles.macroRow}>
          <span className={styles.label}>{t('macros.total')}</span>
          <span className={styles.value}>{Math.round(totalPlanned.calories)} kcal</span>
          <span className={styles.macro}>P: {Math.round(totalPlanned.protein)}g</span>
          <span className={styles.macro}>C: {Math.round(totalPlanned.carbs)}g</span>
          <span className={styles.macro}>G: {Math.round(totalPlanned.fats)}g</span>
        </div>

        <div className={`${styles.macroRow} ${styles.remaining}`}>
          <span className={styles.label}>{t('macros.remaining')}</span>
          <span className={styles.value}>{Math.round(remaining.calories)} kcal</span>
          <span className={styles.macro}>P: {Math.round(remaining.protein)}g</span>
          <span className={styles.macro}>C: {Math.round(remaining.carbs)}g</span>
          <span className={styles.macro}>G: {Math.round(remaining.fats)}g</span>
        </div>
      </div>

      <div className={styles.progressWrapper}>
        <ProgressBar value={percentConsumed} variant="accent" />
        <span className={styles.percentLabel}>{percentConsumed}% consumido</span>
      </div>
    </div>
  );
}
