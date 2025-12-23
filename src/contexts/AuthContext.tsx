import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';

// Timeout máximo para verificação de autenticação (5 segundos)
const AUTH_TIMEOUT_MS = 5000;

// Keys para localStorage
const ROLE_CACHE_KEY = 'mc_user_role';
const USER_ID_CACHE_KEY = 'mc_user_id';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; isAdmin: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Funções para cache de role
function getCachedRole(): string | null {
  try {
    return localStorage.getItem(ROLE_CACHE_KEY);
  } catch {
    return null;
  }
}

function getCachedUserId(): string | null {
  try {
    return localStorage.getItem(USER_ID_CACHE_KEY);
  } catch {
    return null;
  }
}

function setCachedRole(role: string, userId: string): void {
  try {
    localStorage.setItem(ROLE_CACHE_KEY, role);
    localStorage.setItem(USER_ID_CACHE_KEY, userId);
  } catch {
    // Ignorar erro de localStorage
  }
}

function clearCachedRole(): void {
  try {
    localStorage.removeItem(ROLE_CACHE_KEY);
    localStorage.removeItem(USER_ID_CACHE_KEY);
    localStorage.removeItem('sb-nibzlpxnwzufowssyaso-auth-token');
  } catch {
    // Ignorar erro de localStorage
  }
}

// Função para buscar o profile do usuário
async function fetchProfile(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Erro ao buscar profile:', error.message);
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Inicializar isAdmin do cache para evitar flicker no refresh
  const cachedRole = getCachedRole();
  const cachedUserId = getCachedUserId();

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(cachedRole?.toLowerCase() === 'admin');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initCompleteRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    // Timeout de segurança - garante que loading sempre termine
    timeoutRef.current = setTimeout(() => {
      if (isMounted && loading) {
        console.warn('Auth timeout: forçando fim do loading após 5 segundos');
        setLoading(false);
      }
    }, AUTH_TIMEOUT_MS);

    async function initAuth() {
      try {
        // Verificar se existe sessão salva
        const { data: { session: existingSession } } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (existingSession?.user) {
          // Tem sessão válida - restaurar
          setSession(existingSession);
          setUser(existingSession.user);

          // Verificar se o cache é válido (mesmo userId)
          if (cachedUserId === existingSession.user.id && cachedRole) {
            // Cache válido - usar role cacheada imediatamente
            setIsAdmin(cachedRole.toLowerCase() === 'admin');
          }

          // Buscar profile do banco (com timeout de 4 segundos)
          const userProfile = await Promise.race([
            fetchProfile(existingSession.user.id),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000))
          ]);

          if (isMounted && userProfile) {
            setProfile(userProfile);
            const roleFromDb = userProfile.role?.toLowerCase() === 'admin';
            setIsAdmin(roleFromDb);
            // Atualizar cache com role do banco
            setCachedRole(userProfile.role, existingSession.user.id);
          }
        } else {
          // Sem sessão - limpar tudo
          setUser(null);
          setSession(null);
          setProfile(null);
          setIsAdmin(false);
          clearCachedRole();
        }
      } catch (error) {
        // Em caso de erro, limpar tudo
        console.error('Erro na inicialização de auth:', error);
        if (isMounted) {
          setUser(null);
          setSession(null);
          setProfile(null);
          setIsAdmin(false);
          clearCachedRole();
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          initCompleteRef.current = true;
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
        }
      }
    }

    initAuth();

    // Listener para mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!isMounted) return;

        // Ignorar eventos durante inicialização
        if (!initCompleteRef.current) return;

        if (event === 'SIGNED_OUT' || !newSession) {
          // Logout - limpar tudo
          setUser(null);
          setSession(null);
          setProfile(null);
          setIsAdmin(false);
          clearCachedRole();
          return;
        }

        if (event === 'SIGNED_IN' && newSession?.user) {
          // Login - atualizar estado
          setSession(newSession);
          setUser(newSession.user);

          // Buscar profile
          const userProfile = await fetchProfile(newSession.user.id);
          if (isMounted && userProfile) {
            setProfile(userProfile);
            const roleFromDb = userProfile.role?.toLowerCase() === 'admin';
            setIsAdmin(roleFromDb);
            setCachedRole(userProfile.role, newSession.user.id);
          }
        }

        if (event === 'TOKEN_REFRESHED' && newSession) {
          // Token atualizado - manter sessão
          setSession(newSession);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function signIn(email: string, password: string): Promise<{ error: Error | null; isAdmin: boolean }> {
    try {
      // Fazer login
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        // Login falhou - garantir que não há sessão
        setUser(null);
        setSession(null);
        setProfile(null);
        setIsAdmin(false);
        return { error, isAdmin: false };
      }

      if (!data.user || !data.session) {
        return { error: new Error('Erro ao fazer login'), isAdmin: false };
      }

      // Login bem sucedido - atualizar estado
      setUser(data.user);
      setSession(data.session);

      // Buscar profile
      const userProfile = await fetchProfile(data.user.id);
      setProfile(userProfile);

      const isUserAdmin = userProfile?.role?.toLowerCase() === 'admin';
      setIsAdmin(isUserAdmin);

      // Salvar no cache
      if (userProfile) {
        setCachedRole(userProfile.role, data.user.id);
      }

      return { error: null, isAdmin: isUserAdmin };
    } catch (err) {
      // Erro inesperado - limpar tudo
      setUser(null);
      setSession(null);
      setProfile(null);
      setIsAdmin(false);
      return { error: err as Error, isAdmin: false };
    }
  }

  async function signOut(): Promise<void> {
    // Limpar estado local PRIMEIRO (garante que UI atualiza imediatamente)
    setUser(null);
    setProfile(null);
    setSession(null);
    setIsAdmin(false);

    // Limpar cache
    clearCachedRole();

    // Tentar signOut do Supabase com timeout de 3 segundos
    try {
      const signOutPromise = supabase.auth.signOut();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 3000)
      );

      await Promise.race([signOutPromise, timeoutPromise]);
    } catch {
      // Logout Supabase falhou ou timeout, mas estado local foi limpo
    }
  }

  async function refreshProfile(): Promise<void> {
    if (!user?.id) return;

    const userProfile = await fetchProfile(user.id);
    if (userProfile) {
      setProfile(userProfile);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        signIn,
        signOut,
        refreshProfile,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
