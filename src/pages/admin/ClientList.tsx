import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ChevronRight, Plus, LogOut, Utensils, Dumbbell, BookOpen, Cake, Hourglass } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { PageContainer } from '../../components/layout';
import { Card, Input } from '../../components/ui';
import { AddClientModal } from '../../components/admin/AddClientModal';
import type { Profile } from '../../types/database';
import { daysUntilPlanEnd, isPlanExpired } from '../../utils/planStatus';
import styles from './ClientList.module.css';

interface ClientWithPlans extends Profile {
  dietUpdatedAt: string | null;
  workoutUpdatedAt: string | null;
}

type StatusFilter = 'active' | 'inactive';

// sessionStorage: ao abrir um aluno e voltar, a lista continua na mesma aba.
const STATUS_FILTER_KEY = 'admin_client_status_filter';

function readStatusFilter(): StatusFilter {
  try {
    return sessionStorage.getItem(STATUS_FILTER_KEY) === 'inactive' ? 'inactive' : 'active';
  } catch {
    return 'active';
  }
}

/** "2026-08-10" -> "10/08", sem passar por Date (evita cair no dia anterior pelo fuso). */
function formatPlanDate(dateStr: string): string {
  const [, m, d] = dateStr.slice(0, 10).split('-');
  return `${d}/${m}`;
}

export function ClientList() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [clients, setClients] = useState<ClientWithPlans[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(readStatusFilter);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchClients = useCallback(async () => {
    setLoading(true);

    try {
      // Buscar todos os dados em paralelo com uma unica query por tabela
      const [profilesResult, dietPlansResult, workoutPlansResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('role', 'client')
          .eq('is_active', true)
          .order('full_name'),
        supabase
          .from('diet_plans')
          .select('client_id, updated_at'),
        supabase
          .from('workout_plans')
          .select('client_id, updated_at, created_at')
          .order('created_at', { ascending: false })
      ]);

      const profilesData = profilesResult.data || [];
      const dietPlans = dietPlansResult.data || [];
      const workoutPlans = workoutPlansResult.data || [];

      // Criar mapas para lookup rapido O(1)
      const dietMap = new Map<string, string>();
      dietPlans.forEach(dp => {
        if (!dietMap.has(dp.client_id)) {
          dietMap.set(dp.client_id, dp.updated_at);
        }
      });

      const workoutMap = new Map<string, string>();
      workoutPlans.forEach(wp => {
        // Apenas o primeiro (mais recente devido ao order)
        if (!workoutMap.has(wp.client_id)) {
          workoutMap.set(wp.client_id, wp.updated_at);
        }
      });

      // Combinar dados - O(n) ao inves de O(n*m)
      const clientsWithPlans: ClientWithPlans[] = profilesData.map(client => ({
        ...client,
        dietUpdatedAt: dietMap.get(client.id) || null,
        workoutUpdatedAt: workoutMap.get(client.id) || null,
      }));

      setClients(clientsWithPlans);
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const changeStatusFilter = (value: StatusFilter) => {
    setStatusFilter(value);
    try {
      sessionStorage.setItem(STATUS_FILTER_KEY, value);
    } catch {
      // storage bloqueado: a aba so nao e lembrada
    }
  };

  // A busca vale para as duas abas; os contadores refletem o que foi digitado.
  const searchedClients = clients.filter((client) =>
    client.full_name.toLowerCase().includes(search.toLowerCase())
  );
  const activeClients = searchedClients.filter((c) => !isPlanExpired(c.plan_end_date));
  const inactiveClients = searchedClients.filter((c) => isPlanExpired(c.plan_end_date));
  const filteredClients = statusFilter === 'active' ? activeClients : inactiveClients;

  // Aniversariantes do dia (timezone Brasilia)
  const todaysBirthdays = (() => {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = fmt.formatToParts(new Date());
    const todayMonth = Number(parts.find((p) => p.type === 'month')?.value ?? '0');
    const todayDay = Number(parts.find((p) => p.type === 'day')?.value ?? '0');

    return clients.filter((c) => {
      if (!c.birth_date) return false;
      const [, m, d] = c.birth_date.split('-').map(Number);
      return m === todayMonth && d === todayDay;
    });
  })();

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      month: 'short',
      year: 'numeric',
    });
  }

  function getUpdateStatus(dateStr: string | null): 'ok' | 'warning' | 'notset' {
    if (!dateStr) return 'notset';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 7) return 'ok';
    return 'warning';
  }

  function formatShortDate(dateStr: string | null): string {
    if (!dateStr) return 'Não configurado';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
  }

  return (
    <PageContainer hasBottomNav={false}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.logo}>
            <span className={styles.logoText}>MC</span>
          </div>
          <div className={styles.brandText}>
            <h1 className={styles.brandName}>MICHAEL CEZAR</h1>
            <p className={styles.brandTitle}>NUTRICIONISTA</p>
          </div>
          <button
            className={styles.libraryButton}
            onClick={() => navigate('/admin/biblioteca')}
            title="Biblioteca"
          >
            <BookOpen size={20} />
          </button>
          <button
            className={styles.logoutButton}
            onClick={() => {
              signOut().finally(() => {
                navigate('/admin/login', { replace: true });
              });
            }}
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className={styles.content}>
        {todaysBirthdays.length > 0 && (
          <div className={styles.birthdayBanner}>
            <div className={styles.birthdayIcon}>
              <Cake size={22} />
            </div>
            <div className={styles.birthdayContent}>
              <strong className={styles.birthdayTitle}>
                {todaysBirthdays.length === 1
                  ? 'Hoje é aniversário de:'
                  : `Hoje é aniversário de ${todaysBirthdays.length} alunos:`}
              </strong>
              <div className={styles.birthdayList}>
                {todaysBirthdays.map((c) => (
                  <Link
                    key={c.id}
                    to={`/admin/aluno/${c.id}`}
                    className={styles.birthdayName}
                  >
                    🎉 {c.full_name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className={styles.searchWrapper}>
          <Input
            type="search"
            placeholder="Buscar aluno..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search size={20} />}
          />
        </div>

        <div className={styles.filterTabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === 'active'}
            className={`${styles.filterTab} ${statusFilter === 'active' ? styles.filterTabActive : ''}`}
            onClick={() => changeStatusFilter('active')}
          >
            Alunos ativos <span className={styles.filterCount}>{activeClients.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === 'inactive'}
            className={`${styles.filterTab} ${statusFilter === 'inactive' ? styles.filterTabActive : ''}`}
            onClick={() => changeStatusFilter('inactive')}
          >
            Alunos inativos <span className={styles.filterCount}>{inactiveClients.length}</span>
          </button>
        </div>

        <p className={styles.clientCount}>
          {filteredClients.length} aluno{filteredClients.length !== 1 ? 's' : ''}{' '}
          {statusFilter === 'active' ? 'ativo' : 'inativo'}{filteredClients.length !== 1 ? 's' : ''}
          {statusFilter === 'inactive' && ' (plano vencido)'}
        </p>

        <div className={styles.clientList}>
          {loading ? (
            <div className={styles.loading}>Carregando...</div>
          ) : filteredClients.length > 0 ? (
            filteredClients.map((client) => {
              const dietStatus = getUpdateStatus(client.dietUpdatedAt);
              const workoutStatus = getUpdateStatus(client.workoutUpdatedAt);

              return (
                <Link
                  key={client.id}
                  to={`/admin/aluno/${client.id}`}
                  className={styles.clientLink}
                >
                  <Card hoverable className={styles.clientCard}>
                    <div className={styles.clientAvatar}>
                      {client.photo_url ? (
                        <img src={client.photo_url} alt="" />
                      ) : (
                        <span>{client.full_name.charAt(0)}</span>
                      )}
                    </div>
                    <div className={styles.clientInfo}>
                      <h3 className={styles.clientName}>{client.full_name}</h3>
                      {client.coaching_start_date && (
                        <p className={styles.clientSince}>
                          Desde {formatDate(client.coaching_start_date)}
                        </p>
                      )}
                      <div className={styles.statusRow}>
                        <span className={`${styles.statusBadge} ${styles[dietStatus]}`}>
                          <Utensils size={12} />
                          {formatShortDate(client.dietUpdatedAt)}
                        </span>
                        <span className={`${styles.statusBadge} ${styles[workoutStatus]}`}>
                          <Dumbbell size={12} />
                          {formatShortDate(client.workoutUpdatedAt)}
                        </span>
                        {statusFilter === 'active' && (() => {
                          const days = daysUntilPlanEnd(client.plan_end_date);
                          if (days === null) {
                            return (
                              <span className={`${styles.statusBadge} ${styles.notset}`}>
                                <Hourglass size={12} />
                                Sem término
                              </span>
                            );
                          }
                          // Ultima semana em amarelo, para lembrar da renovacao.
                          return (
                            <span className={`${styles.statusBadge} ${days <= 7 ? styles.warning : styles.ok}`}>
                              <Hourglass size={12} />
                              {days === 0 ? 'Vence hoje' : `${days} dia${days !== 1 ? 's' : ''}`}
                            </span>
                          );
                        })()}
                        {statusFilter === 'inactive' && client.plan_end_date && (
                          <span className={`${styles.statusBadge} ${styles.expired}`}>
                            Venceu em {formatPlanDate(client.plan_end_date)}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={20} className={styles.clientArrow} />
                  </Card>
                </Link>
              );
            })
          ) : (
            <div className={styles.emptyState}>
              <p>Nenhum aluno encontrado</p>
            </div>
          )}
        </div>
      </main>

      <button className={styles.fab} onClick={() => setShowAddModal(true)}>
        <Plus size={24} />
      </button>

      <AddClientModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          fetchClients();
        }}
      />
    </PageContainer>
  );
}
