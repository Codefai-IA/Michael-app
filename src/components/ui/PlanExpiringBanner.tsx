import { useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../../i18n';
import styles from './PlanExpiringBanner.module.css';

interface PlanExpiringBannerProps {
  daysRemaining: number;
}

export function PlanExpiringBanner({ daysRemaining }: PlanExpiringBannerProps) {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className={styles.banner}>
      <span className={styles.message}>
        Seu plano expira em {daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'}!
        Entre em contato para renovar.
      </span>
      <button
        onClick={() => setDismissed(true)}
        className={styles.closeButton}
        aria-label={t('banner.close')}
      >
        <X size={16} />
      </button>
    </div>
  );
}
