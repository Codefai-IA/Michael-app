import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import styles from './BirthdayModal.module.css';

const BIRTHDAY_BONUS_DAYS = 15;

function getBrasiliaDateParts(): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  return { year: get('year'), month: get('month'), day: get('day') };
}

export function BirthdayModal() {
  const { user, profile, isAdmin } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user || isAdmin || !profile?.birth_date) return;

    const today = getBrasiliaDateParts();
    // birth_date format: 'YYYY-MM-DD'
    const [, bm, bd] = profile.birth_date.split('-').map(Number);

    if (bm !== today.month || bd !== today.day) return;

    const key = `birthday-shown-${user.id}-${today.year}`;
    if (localStorage.getItem(key)) return;

    // Marca imediatamente para evitar conceder bonus duas vezes
    localStorage.setItem(key, '1');

    // Estende o plano em +15 dias (a partir do plan_end_date atual, ou de hoje se nao houver)
    (async () => {
      const baseStr = profile.plan_end_date ?? `${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`;
      const base = new Date(baseStr);
      base.setDate(base.getDate() + BIRTHDAY_BONUS_DAYS);
      const newEnd = base.toISOString().split('T')[0];

      const { error } = await supabase
        .from('profiles')
        .update({ plan_end_date: newEnd, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) {
        console.error('Erro ao conceder bonus de aniversario:', error);
      }
    })();

    setShow(true);
  }, [user, profile?.birth_date, profile?.plan_end_date, isAdmin]);

  function handleClose() {
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.confetti}>🎉</div>

        <h2 className={styles.title}>Feliz aniversário!</h2>

        <p className={styles.message}>
          🎉 Feliz aniversário! Hoje pode comemorar, mas ó… sem esquecer da dieta em 😅
        </p>

        <p className={styles.signature}>
          Nutri Michael te deseja muita saúde, felicidade e muitos resultados!
        </p>

        <div className={styles.bonus}>
          🎁 Você acabou de ganhar <strong>+15 dias</strong> de planejamento!
        </div>

        <button onClick={handleClose} className={styles.button}>
          Obrigado, Michael!
        </button>
      </div>
    </div>
  );
}
