import { useNavigate } from 'react-router-dom';
import { Utensils, Dumbbell, TrendingUp } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../i18n';
import { formatWeight } from '../../utils/units';
import styles from './PlanExpiredScreen.module.css';

// Retorna a data atual no fuso horário de Brasília
function getBrasiliaDate(): string {
  const now = new Date();
  const brasiliaOffset = -3 * 60;
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const brasiliaTime = new Date(utc + (brasiliaOffset * 60000));
  return brasiliaTime.toISOString().split('T')[0];
}

interface PlanExpiredScreenProps {
  planEndDate: string;
  nutritionistWhatsapp?: string;
  startingWeight?: number | null;
  currentWeight?: number | null;
  goalWeight?: number | null;
}

function getProgressMessage(
  startingWeight?: number | null,
  currentWeight?: number | null,
  goalWeight?: number | null
): { messageKey: 'expired.progressOnTrack' | 'expired.progressLost' | 'expired.progressGained' | 'expired.progressEncourage'; value?: number; emoji: string } | null {
  if (!startingWeight || !currentWeight) return null;

  const diff = startingWeight - currentWeight;
  const absDiff = Math.abs(diff);

  // Less than 0.5kg change - no significant progress
  if (absDiff < 0.5) {
    return {
      messageKey: 'expired.progressOnTrack',
      emoji: '\uD83D\uDCAA'
    };
  }

  // Lost weight
  if (diff > 0) {
    return {
      messageKey: 'expired.progressLost',
      value: absDiff,
      emoji: '\uD83C\uDF89'
    };
  }

  // Gained weight - check if goal is to gain (goal > starting)
  if (diff < 0) {
    const isGainGoal = goalWeight && goalWeight > startingWeight;
    if (isGainGoal) {
      return {
        messageKey: 'expired.progressGained',
        value: absDiff,
        emoji: '\uD83D\uDCAA'
      };
    } else {
      // Gained but goal was to lose - still encourage
      return {
        messageKey: 'expired.progressEncourage',
        emoji: '\uD83D\uDE4C'
      };
    }
  }

  return null;
}

export function PlanExpiredScreen({ planEndDate, nutritionistWhatsapp, startingWeight, currentWeight, goalWeight }: PlanExpiredScreenProps) {
  const navigate = useNavigate();
  const { t, locale, unitSystem } = useI18n();
  const { signOut } = useAuth();

  const daysSinceExpired = Math.abs(
    Math.ceil(
      (new Date(getBrasiliaDate()).getTime() - new Date(planEndDate).getTime()) / (1000 * 60 * 60 * 24)
    )
  );

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const whatsappNumber = nutritionistWhatsapp || '5511965293803';
  const whatsappMessage = encodeURIComponent(t('expired.whatsappMessage'));
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

  const progressInfo = getProgressMessage(startingWeight, currentWeight, goalWeight);

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        {/* Custom Icon at Top */}
        <img src="/expired-icon.png" alt="" className={styles.expiredIcon} />

        {/* Title */}
        <h1 className={styles.title}>{t('expired.title')}</h1>

        {/* Progress Message - Under the icon/title */}
        {progressInfo && (
          <div className={styles.progressBox}>
            <p className={styles.progressMessage}>
              {t(progressInfo.messageKey, {
                value: progressInfo.value !== undefined
                  ? formatWeight(progressInfo.value, unitSystem, locale)
                  : '',
              })}
            </p>
            {startingWeight && currentWeight && (
              <p className={styles.progressWeights}>
                {formatWeight(startingWeight, unitSystem, locale)} → {formatWeight(currentWeight, unitSystem, locale)}
              </p>
            )}
          </div>
        )}

        {/* Expiry Info */}
        <p className={styles.expiryInfo}>
          {daysSinceExpired === 1
            ? t('expired.endedOneDay')
            : t('expired.endedDays', { count: daysSinceExpired })}
          <br />
          <span className={styles.expiryDate}>
            ({new Date(planEndDate).toLocaleDateString(locale)})
          </span>
        </p>

        {/* Warning Message */}
        <div className={styles.messageBox}>
          <p>
            {t('expired.warning')}
          </p>
        </div>

        {/* What's Blocked */}
        <div className={styles.blockedSection}>
          <p className={styles.blockedLabel}>{t('expired.blockedLabel')}</p>
          <div className={styles.blockedIcons}>
            <div className={styles.blockedItem}>
              <div className={styles.blockedIcon}>
                <Utensils size={20} />
              </div>
              <span>{t('expired.blockedDiet')}</span>
            </div>
            <div className={styles.blockedItem}>
              <div className={styles.blockedIcon}>
                <Dumbbell size={20} />
              </div>
              <span>{t('expired.blockedWorkout')}</span>
            </div>
            <div className={styles.blockedItem}>
              <div className={styles.blockedIcon}>
                <TrendingUp size={20} />
              </div>
              <span>{t('expired.blockedProgress')}</span>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.whatsappButton}
        >
          {t('expired.renew')}
        </a>

        {/* Secondary Text */}
        <p className={styles.secondaryText}>
          {t('expired.secondary')}
        </p>

        {/* Logout Option */}
        <button onClick={handleLogout} className={styles.logoutButton}>
          {t('expired.logout')}
        </button>
      </div>
    </div>
  );
}
