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
        {daysRemaining === 1
          ? t('banner.expiringOne')
          : t('banner.expiringMany', { count: daysRemaining })}{' '}
        {t('banner.contact')}
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
