import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Button, Input } from '../../components/ui';
import { useI18n } from '../../i18n';
import styles from './Login.module.css';

export function Login() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    if (!email.trim() || !password.trim()) {
      setError(t('login.fillAllFields'));
      setLoading(false);
      return;
    }

    try {
      const { error: signInError, isAdmin } = await signIn(email, password);

      if (signInError) {
        setError(t('login.wrongCredentials'));
        setLoading(false);
        return;
      }

      // Se for admin, redireciona para login de admin
      if (isAdmin) {
        setError(t('login.useAdminPanel'));
        setLoading(false);
        return;
      }

      // Aluno - redirecionar para app
      navigate('/app', { replace: true });
    } catch {
      setError(t('login.genericError'));
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setError('');
    setSuccessMessage('');

    if (!email.trim()) {
      setError(t('login.typeEmailToReset'));
      return;
    }

    setResetLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (resetError) {
        setError(t('login.resetError'));
      } else {
        setSuccessMessage(t('login.resetSent'));
      }
    } catch {
      setError(t('login.resetError'));
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.logo}>
          <img src="/logo-icon.png" alt={t('login.logoAlt')} className={styles.logoText} />
        </div>
      </div>

      <div className={styles.formCard}>
        <h1 className={styles.title}>{t('login.welcome')}</h1>
        <p className={styles.subtitle}>{t('login.subtitle')}</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <Input
            type="email"
            placeholder={t('login.emailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail size={20} />}
            autoComplete="email"
            required
          />

          <div className={styles.passwordWrapper}>
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder={t('login.passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock size={20} />}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className={styles.togglePassword}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {error && <p className={styles.error}>{error}</p>}
          {successMessage && <p className={styles.success}>{successMessage}</p>}

          <Button type="submit" fullWidth loading={loading}>
            {t('login.submit')}
          </Button>

          <button
            type="button"
            className={styles.forgotPassword}
            onClick={handleForgotPassword}
            disabled={resetLoading}
          >
            {resetLoading ? t('login.sending') : t('login.forgotPassword')}
          </button>
        </form>
      </div>
    </div>
  );
}
