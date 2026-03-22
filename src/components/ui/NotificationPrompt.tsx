import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { subscribeToPush } from '../../lib/pushNotifications';
import styles from './NotificationPrompt.module.css';

interface NotificationPromptProps {
  isAuthenticated: boolean;
  isAdmin: boolean;
  userId: string | null;
}

export function NotificationPrompt({ isAuthenticated, isAdmin, userId }: NotificationPromptProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || isAdmin || !userId) return;

    // Don't show if notifications not supported
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;

    // Don't show if already granted or denied
    if (Notification.permission !== 'default') return;

    // Don't show if user already answered our prompt
    const promptStatus = localStorage.getItem('notification-prompt-status');
    if (promptStatus === 'dismissed') {
      const dismissedAt = localStorage.getItem('notification-prompt-dismissed-at');
      if (dismissedAt && Date.now() - parseInt(dismissedAt) < 30 * 24 * 60 * 60 * 1000) {
        return;
      }
    }
    if (promptStatus === 'granted') return;

    // Wait for install prompt to finish (if showing), then show notification prompt
    const timer = setTimeout(() => {
      // Check again in case InstallPWA is still visible
      const installStatus = localStorage.getItem('pwa-install-status');
      const installVisible = !installStatus || (installStatus !== 'installed' && installStatus !== 'dismissed');

      // If install modal might still be showing, delay a bit more
      const delay = installVisible ? 3000 : 500;

      setTimeout(() => {
        setShow(true);
      }, delay);
    }, 2500);

    return () => clearTimeout(timer);
  }, [isAuthenticated, isAdmin, userId]);

  async function handleEnable() {
    if (!userId) return;

    localStorage.setItem('notification-prompt-status', 'granted');
    setShow(false);

    // This will trigger the native browser permission popup
    await subscribeToPush(userId);
  }

  function handleLater() {
    setShow(false);
  }

  function handleDismiss() {
    setShow(false);
    localStorage.setItem('notification-prompt-status', 'dismissed');
    localStorage.setItem('notification-prompt-dismissed-at', Date.now().toString());
  }

  if (!show) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.iconContainer}>
          <div className={styles.iconWrapper}>
            <Bell size={36} />
          </div>
        </div>

        <h2 className={styles.title}>Ativar Notificacoes</h2>

        <p className={styles.description}>
          Receba avisos quando seu nutricionista atualizar sua dieta ou treino.
        </p>

        <div className={styles.benefits}>
          <div className={styles.benefitItem}>
            <span className={styles.checkIcon}>&#10003;</span>
            <span>Saiba quando sua dieta for atualizada</span>
          </div>
          <div className={styles.benefitItem}>
            <span className={styles.checkIcon}>&#10003;</span>
            <span>Saiba quando seu treino for alterado</span>
          </div>
          <div className={styles.benefitItem}>
            <span className={styles.checkIcon}>&#10003;</span>
            <span>Nunca perca uma atualizacao</span>
          </div>
        </div>

        <button onClick={handleEnable} className={styles.enableButton}>
          <Bell size={18} />
          Ativar Notificacoes
        </button>

        <div className={styles.secondaryActions}>
          <button onClick={handleLater} className={styles.laterButton}>
            Depois
          </button>
          <button onClick={handleDismiss} className={styles.dismissButton}>
            Nao mostrar
          </button>
        </div>
      </div>
    </div>
  );
}
