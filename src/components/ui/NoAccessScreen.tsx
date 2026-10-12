import { UserX } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../i18n';
import styles from './UpgradeScreen.module.css';

/**
 * Login valido no Supabase, mas sem cadastro de aluno em `profiles`.
 * Acontece com quem comprou so a Escola do Nutri (outra aplicacao no mesmo Supabase):
 * o app nao pode abrir vazio nem criar o perfil sozinho.
 */
export function NoAccessScreen() {
  const { t } = useI18n();
  const { signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    window.location.replace('/login');
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.lockIcon}>
          <UserX size={32} />
        </div>
        <h1 className={styles.title}>{t('noAccess.title')}</h1>
        <p className={styles.subtitle}>{t('noAccess.subtitle')}</p>
        <button type="button" onClick={handleSignOut} className={styles.cta} style={{ border: 'none', cursor: 'pointer' }}>
          {t('noAccess.signOut')}
        </button>
      </div>
    </div>
  );
}
