import { TrendingUp } from 'lucide-react';
import { formatDuration, type WorkoutHighlight } from '../../lib/workoutProgress';
import { useI18n } from '../../i18n';
import styles from './WorkoutSummaryModal.module.css';

interface WorkoutSummaryModalProps {
  durationMs: number;
  highlights: WorkoutHighlight[];
  onClose: () => void;
}

export function WorkoutSummaryModal({ durationMs, highlights, onClose }: WorkoutSummaryModalProps) {
  const { t } = useI18n();
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.trophy}>🎉</div>

        <h2 className={styles.title}>{t('summary.title')}</h2>

        <p className={styles.duration}>
          {t('summary.duration', {
            duration: formatDuration(durationMs, {
              lessThanMinute: t('summary.lessThanMinute'),
              minuteSuffix: t('summary.minuteSuffix'),
            }),
          })}
        </p>

        {highlights.length > 0 ? (
          <div className={styles.highlights}>
            {highlights.map((h, i) => (
              <div key={i} className={styles.highlightRow}>
                <TrendingUp size={16} className={styles.highlightIcon} />
                <span>
                  {t(h.kind === 'weight' ? 'summary.weightUp' : 'summary.repsUp', {
                    exercise: h.exerciseName,
                    from: h.from,
                    to: h.to,
                  })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.noHighlights}>{t('summary.noHighlights')}</p>
        )}

        <button onClick={onClose} className={styles.button}>
          {t('summary.finish')}
        </button>
      </div>
    </div>
  );
}
