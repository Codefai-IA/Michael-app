import { TrendingUp } from 'lucide-react';
import { formatDuration, type WorkoutHighlight } from '../../lib/workoutProgress';
import styles from './WorkoutSummaryModal.module.css';

interface WorkoutSummaryModalProps {
  durationMs: number;
  highlights: WorkoutHighlight[];
  onClose: () => void;
}

export function WorkoutSummaryModal({ durationMs, highlights, onClose }: WorkoutSummaryModalProps) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.trophy}>🎉</div>

        <h2 className={styles.title}>Parabéns! Você concluiu seu treino.</h2>

        <p className={styles.duration}>
          Você concluiu o treino em <strong>{formatDuration(durationMs)}</strong>.
        </p>

        {highlights.length > 0 ? (
          <div className={styles.highlights}>
            {highlights.map((h, i) => (
              <div key={i} className={styles.highlightRow}>
                <TrendingUp size={16} className={styles.highlightIcon} />
                <span>{h.message}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.noHighlights}>Continue assim — cada treino conta! 💪</p>
        )}

        <button onClick={onClose} className={styles.button}>
          Concluir
        </button>
      </div>
    </div>
  );
}
