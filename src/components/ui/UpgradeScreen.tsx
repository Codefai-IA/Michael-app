import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Utensils, TrendingUp, BookOpen, Trophy } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../i18n';
import { BottomNav } from '../layout/BottomNav';
import styles from './UpgradeScreen.module.css';

const FALLBACK_WHATSAPP = '5511965293803';

/**
 * Tela das abas bloqueadas do aluno low ticket (Dieta, Progresso, Orientacoes, Ranking,
 * Calendario). O botao leva ao checkout do plano completo (app_settings.upgrade_url) ou,
 * sem link cadastrado, ao WhatsApp do nutricionista.
 */
export function UpgradeScreen() {
  const { t } = useI18n();
  const [upgradeUrl, setUpgradeUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('upgrade_url')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setUpgradeUrl(data?.upgrade_url || null));
  }, []);

  const href =
    upgradeUrl ||
    `https://wa.me/${FALLBACK_WHATSAPP}?text=${encodeURIComponent(t('upgrade.whatsappMessage'))}`;

  const benefits = [
    { icon: Utensils, label: t('upgrade.benefitDiet') },
    { icon: TrendingUp, label: t('upgrade.benefitProgress') },
    { icon: BookOpen, label: t('upgrade.benefitGuidelines') },
    { icon: Trophy, label: t('upgrade.benefitRanking') },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.lockIcon}>
          <Lock size={32} />
        </div>
        <h1 className={styles.title}>{t('upgrade.title')}</h1>
        <p className={styles.subtitle}>{t('upgrade.subtitle')}</p>

        <ul className={styles.benefits}>
          {benefits.map(({ icon: Icon, label }) => (
            <li key={label} className={styles.benefit}>
              <span className={styles.benefitIcon}>
                <Icon size={18} />
              </span>
              {label}
            </li>
          ))}
        </ul>

        <a href={href} target="_blank" rel="noopener noreferrer" className={styles.cta}>
          {t('upgrade.cta')}
        </a>
        <Link to="/app/treino" className={styles.secondary}>
          {t('upgrade.backToWorkout')}
        </Link>
      </div>
      <BottomNav />
    </div>
  );
}
