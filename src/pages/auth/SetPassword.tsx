import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Input } from '../../components/ui';
import { useI18n } from '../../i18n';
import styles from './Login.module.css';

type Stage = 'verifying' | 'ready' | 'invalid';
type OtpType = 'invite' | 'recovery' | 'signup' | 'magiclink' | 'email';
const OTP_TYPES: OtpType[] = ['invite', 'recovery', 'signup', 'magiclink', 'email'];

/**
 * Pagina do link do e-mail: convite da compra low ticket ("crie sua senha") e "esqueci minha
 * senha". O cliente Supabase usa detectSessionInUrl: false, entao o login a partir do link e
 * feito aqui, aceitando os dois formatos:
 *   - ?token_hash=...&type=invite|recovery  (template de e-mail customizado — preferido)
 *   - #access_token=...&refresh_token=...    (template padrao do Supabase)
 */
export function SetPassword() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stage, setStage] = useState<Stage>('verifying');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // O token do link e de uso unico: o StrictMode roda o efeito 2x e a 2a chamada falharia.
  const startedRef = useRef(false);
  // Sessao criada pelo link. A sessao fica no localStorage, compartilhado entre abas: outra aba
  // do app (admin, conta antiga) pode sobrescrever ou apagar, e o updateUser falharia sem nem
  // chamar o servidor. Guardar aqui permite restaurar antes de salvar.
  const linkSessionRef = useRef<Session | null>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    async function verifyLink() {
      const query = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const tokenHash = query.get('token_hash');
      const type = query.get('type') as OtpType | null;
      const accessToken = hash.get('access_token');
      const refreshToken = hash.get('refresh_token');

      let ok = false;
      if (tokenHash && type && OTP_TYPES.includes(type)) {
        const { data, error: otpError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (otpError) console.error('[SetPassword] verifyOtp:', otpError.code, otpError.message);
        linkSessionRef.current = data.session;
        ok = !otpError;
      } else if (accessToken && refreshToken) {
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) console.error('[SetPassword] setSession:', sessionError.code, sessionError.message);
        linkSessionRef.current = data.session;
        ok = !sessionError;
      } else {
        // Sem token na URL: so serve para quem ja esta logado trocar a senha.
        ok = !!user;
      }

      // Tira o token da barra de endereco (nao fica no historico nem em print).
      window.history.replaceState(null, '', window.location.pathname);
      setStage(ok ? 'ready' : 'invalid');
    }

    verifyLink();
  }, [user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError(t('setPassword.tooShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('setPassword.mismatch'));
      return;
    }

    setSaving(true);
    const linkSession = linkSessionRef.current;
    if (linkSession) {
      const { data: { session: current } } = await supabase.auth.getSession();
      if (current?.user.id !== linkSession.user.id) {
        console.warn('[SetPassword] sessao do link sumiu ou foi trocada por outra aba; restaurando');
        await supabase.auth.setSession({
          access_token: linkSession.access_token,
          refresh_token: linkSession.refresh_token,
        });
      }
    }
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setSaving(false);
      console.error('[SetPassword] updateUser:', updateError.code, updateError.message);
      setError(
        updateError.code === 'same_password'
          ? t('setPassword.samePassword')
          : updateError.code === 'weak_password'
            ? t('setPassword.weakPassword')
            : t('setPassword.error')
      );
      return;
    }
    // Recarrega em vez de navigate: o AuthContext so trata SIGNED_IN, entao depois de um link de
    // "esqueci minha senha" (evento PASSWORD_RECOVERY) ele nao sabe do login e a raiz mandaria
    // para /login. Na carga, o initAuth le a sessao salva. A raiz manda aluno p/ /app e admin p/ /admin.
    window.location.replace('/');
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.logo}>
          <img src="/logo-icon.png" alt={t('login.logoAlt')} className={styles.logoText} />
        </div>
      </div>

      <div className={styles.formCard}>
        <h1 className={styles.title}>{t('setPassword.title')}</h1>

        {stage === 'verifying' && <p className={styles.subtitle}>{t('setPassword.verifying')}</p>}

        {stage === 'invalid' && (
          <>
            <p className={styles.error}>{t('setPassword.invalidLink')}</p>
            <Button fullWidth onClick={() => navigate('/login', { replace: true })}>
              {t('setPassword.goToLogin')}
            </Button>
          </>
        )}

        {stage === 'ready' && (
          <>
            <p className={styles.subtitle}>{t('setPassword.subtitle')}</p>
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.passwordWrapper}>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('setPassword.newPassword')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon={<Lock size={20} />}
                  autoComplete="new-password"
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
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder={t('setPassword.confirmPassword')}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                icon={<Lock size={20} />}
                autoComplete="new-password"
                required
              />

              {error && <p className={styles.error}>{error}</p>}

              <Button type="submit" fullWidth loading={saving}>
                {t('setPassword.submit')}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
