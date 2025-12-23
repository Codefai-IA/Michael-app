import { NavLink } from 'react-router-dom';
import { Home, TrendingUp, Utensils, Dumbbell, ClipboardList } from 'lucide-react';
import styles from './BottomNav.module.css';

const navItems = [
  { to: '/app', icon: Home, label: 'Home' },
  { to: '/app/orientacoes', icon: ClipboardList, label: 'Orientacoes' },
  { to: '/app/progresso', icon: TrendingUp, label: 'Progresso' },
  { to: '/app/dieta', icon: Utensils, label: 'Dieta' },
  { to: '/app/treino', icon: Dumbbell, label: 'Treino' },
];

export function BottomNav() {
  return (
    <nav className={styles.nav}>
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/app'}
          className={({ isActive }) =>
            `${styles.navItem} ${isActive ? styles.active : ''}`
          }
        >
          <Icon size={24} strokeWidth={1.5} />
          <span className={styles.label}>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
