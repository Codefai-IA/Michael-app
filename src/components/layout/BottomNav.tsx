import { NavLink } from 'react-router-dom';
import { House, BookOpen, LineChart, Salad, Dumbbell, CircleUser, Trophy } from 'lucide-react';
import styles from './BottomNav.module.css';

const navItems = [
  { to: '/app', icon: House, label: 'Home' },
  { to: '/app/orientacoes', icon: BookOpen, label: 'Orientações' },
  { to: '/app/progresso', icon: LineChart, label: 'Progresso' },
  { to: '/app/dieta', icon: Salad, label: 'Dieta' },
  { to: '/app/treino', icon: Dumbbell, label: 'Treino' },
  { to: '/app/ranking', icon: Trophy, label: 'Ranking' },
  // Calendário acessível apenas via Ranking (clicando nos nomes); rota /app/calendario continua existindo
  { to: '/app/perfil', icon: CircleUser, label: 'Perfil' },
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
