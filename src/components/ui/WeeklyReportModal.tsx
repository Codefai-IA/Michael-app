import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Camera, FileText } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import styles from './WeeklyReportModal.module.css';

// Número de WhatsApp do nutricionista (formato wa.me: DDI + DDD + número)
const WHATSAPP_NUMBER = '5511965293803';

// Índice da sexta-feira (0 = domingo ... 5 = sexta)
const FRIDAY = 5;

// Retorna { weekday, date } no fuso horário de Brasília
function getBrasiliaToday(): { weekday: number; date: string } {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const weekdayName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
  }).format(now);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { weekday: map[weekdayName] ?? new Date().getDay(), date };
}

// Data (YYYY-MM-DD) da sexta-feira mais recente em relação a hoje.
// Hoje é sexta -> hoje; sáb..qui -> a sexta anterior.
// Serve de âncora semanal: o relatório daquela semana é mostrado na primeira
// abertura a partir da sexta e "expira" sozinho quando chega a próxima sexta.
function getReportFridayDate(): string {
  const { weekday, date } = getBrasiliaToday();
  const daysSinceFriday = (weekday - FRIDAY + 7) % 7;
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - daysSinceFriday);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function WeeklyReportModal() {
  const { user, profile, isAdmin } = useAuth();
  const [show, setShow] = useState(false);
  const navigate = useNavigate();

  // Hoje é realmente sexta? (só pra ajustar o título)
  const isFridayToday = getBrasiliaToday().weekday === FRIDAY;

  useEffect(() => {
    if (!user || isAdmin || !profile) return;

    // Âncora na sexta mais recente: se o aluno não abriu na sexta, aparece
    // na próxima abertura (sáb, dom...) — uma única vez por semana.
    const reportFriday = getReportFridayDate();
    const key = `weekly-report-shown-${user.id}-${reportFriday}`;
    if (localStorage.getItem(key)) return;

    localStorage.setItem(key, '1');
    setShow(true);
  }, [user, profile, isAdmin]);

  function handleClose() {
    setShow(false);
  }

  function handleProgress() {
    setShow(false);
    navigate('/app/progresso');
  }

  function handleWhatsApp() {
    window.open(`https://wa.me/${WHATSAPP_NUMBER}`, '_blank', 'noopener,noreferrer');
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.icon}>📋</div>

        <h2 className={styles.title}>{isFridayToday ? 'É sexta-feira!' : 'Fechamento da semana'}</h2>
        <p className={styles.subtitle}>Hora de fechar a semana. Não esqueça de:</p>

        <ul className={styles.checklist}>
          <li className={styles.item}>
            <TrendingUp size={20} className={styles.itemIcon} />
            <span>Atualizar suas informações na aba <strong>Progresso</strong> (peso e medidas)</span>
          </li>
          <li className={styles.item}>
            <Camera size={20} className={styles.itemIcon} />
            <span>Enviar suas <strong>fotos</strong> no WhatsApp</span>
          </li>
          <li className={styles.item}>
            <FileText size={20} className={styles.itemIcon} />
            <span>Mandar o <strong>relatório semanal</strong></span>
          </li>
        </ul>

        <div className={styles.actions}>
          <button onClick={handleProgress} className={styles.secondaryBtn}>
            Atualizar Progresso
          </button>
          <button onClick={handleWhatsApp} className={styles.primaryBtn}>
            Enviar no WhatsApp
          </button>
        </div>

        <button onClick={handleClose} className={styles.dismissBtn}>
          Lembrar depois
        </button>
      </div>
    </div>
  );
}
