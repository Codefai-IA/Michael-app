import { NavLink } from 'react-router-dom';
import { House, BookOpen, LineChart, Salad, Dumbbell, CircleUser, Trophy, Lock } from 'lucide-react';
import { useI18n, type TKey } from '../../i18n';
import { useAuth } from '../../contexts/AuthContext';
import { isRouteLocked } from '../../utils/accessTier';
import styles from './BottomNav.module.css';

const navItems: { to: string; icon: typeof House; labelKey: TKey }[] = [
  { to: '/app', icon: House, labelKey: 'nav.home' },
  { to: '/app/orientacoes', icon: BookOpen, labelKey: 'nav.guidelines' },
  { to: '/app/progresso', icon: LineChart, labelKey: 'nav.progress' },
  { to: '/app/dieta', icon: Salad, labelKey: 'nav.diet' },
  { to: '/app/treino', icon: Dumbbell, labelKey: 'nav.workout' },
  { to: '/app/ranking', icon: Trophy, labelKey: 'nav.ranking' },
  // Calendário acessível apenas via Ranking (clicando nos nomes); rota /app/calendario continua existindo
  { to: '/app/perfil', icon: CircleUser, labelKey: 'nav.profile' },
];

export function BottomNav() {
  const { t } = useI18n();
  const { profile } = useAuth();

  return (
    <nav className={styles.nav}>
      {navItems.map(({ to, icon: Icon, labelKey }) => {
        // Aluno low ticket: a aba continua visivel (upsell), mas com cadeado e abre a UpgradeScreen.
        const locked = isRouteLocked(profile, to);
        return (
          <NavLink
            key={to}
            to={to}
            end={to === '/app'}
            aria-label={locked ? `${t(labelKey)} (${t('nav.locked')})` : undefined}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.active : ''} ${locked ? styles.locked : ''}`
            }
          >
            <span className={styles.iconWrap}>
              <Icon size={24} strokeWidth={1.5} />
              {locked && (
                <span className={styles.lockBadge}>
                  <Lock size={10} strokeWidth={2.5} />
                </span>
              )}
            </span>
            <span className={styles.label}>{t(labelKey)}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
