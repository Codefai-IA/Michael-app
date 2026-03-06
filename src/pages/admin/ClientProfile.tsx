import { useEffect, useState, useCallback, useRef, useLayoutEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ClipboardList, Utensils, Dumbbell, Trash2, ChevronRight, Clock, AlertCircle, CalendarDays, Check, FileText, Mail, Plus, Copy, TrendingUp, TrendingDown, Scale, Target } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PageContainer, Header } from '../../components/layout';
import { Card, Button, Modal, Input } from '../../components/ui';
import type { Profile, DietPlan, WorkoutPlan, WeightHistory } from '../../types/database';
import styles from './ClientProfile.module.css';


function WeightChart({ weightHistory }: { weightHistory: WeightHistory[] }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<(HTMLDivElement | null)[]>([]);
  const [lines, setLines] = useState<{ x1: number; y1: number; x2: number; y2: number }[]>([]);

  const chartData = weightHistory.slice(0, 7).reverse();
  const maxWeight = Math.max(...chartData.map(w => Number(w.weight_kg)));
  const minWeight = Math.min(...chartData.map(w => Number(w.weight_kg)));
  const range = maxWeight - minWeight || 1;

  const heights = chartData.map(record =>
    Math.round(((Number(record.weight_kg) - minWeight) / range) * 40 + 60)
  );

  useLayoutEffect(() => {
    const updateLines = () => {
      if (!chartRef.current) return;
      const chartRect = chartRef.current.getBoundingClientRect();
      const newLines: { x1: number; y1: number; x2: number; y2: number }[] = [];

      for (let i = 0; i < dotsRef.current.length - 1; i++) {
        const dot1 = dotsRef.current[i];
        const dot2 = dotsRef.current[i + 1];
        if (dot1 && dot2) {
          const rect1 = dot1.getBoundingClientRect();
          const rect2 = dot2.getBoundingClientRect();
          newLines.push({
            x1: rect1.left - chartRect.left + rect1.width / 2,
            y1: rect1.top - chartRect.top + rect1.height / 2,
            x2: rect2.left - chartRect.left + rect2.width / 2,
            y2: rect2.top - chartRect.top + rect2.height / 2,
          });
        }
      }
      setLines(newLines);
    };

    const timer = setTimeout(updateLines, 50);
    window.addEventListener('resize', updateLines);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateLines);
    };
  }, [chartData.length, heights]);

  return (
    <div className={styles.weightChart} ref={chartRef}>
      <svg className={styles.chartLines}>
        {lines.map((line, index) => (
          <line
            key={index}
            x1={line.x1} y1={line.y1}
            x2={line.x2} y2={line.y2}
            className={styles.svgConnectorLine}
          />
        ))}
      </svg>
      {chartData.map((record, index) => (
        <div key={record.id} className={styles.chartBar}>
          <span className={styles.barValue}>{Number(record.weight_kg).toFixed(1)}kg</span>
          <div className={styles.barContainer} style={{ height: `${heights[index]}px` }}>
            <div
              className={styles.barDot}
              ref={el => { dotsRef.current[index] = el; }}
            />
            <div className={styles.bar} />
          </div>
          <span className={styles.barLabel}>
            {new Date(record.recorded_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ClientProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Profile | null>(null);
  const [dietPlans, setDietPlans] = useState<DietPlan[]>([]);
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [weightHistory, setWeightHistory] = useState<WeightHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Plan dates state
  const [planStartDate, setPlanStartDate] = useState('');
  const [planEndDate, setPlanEndDate] = useState('');
  const [savingDates, setSavingDates] = useState(false);
  const [datesSaved, setDatesSaved] = useState(false);

  // Password reset state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // New diet modal state
  const [showNewDietModal, setShowNewDietModal] = useState(false);
  const [newDietName, setNewDietName] = useState('');
  const [creatingDiet, setCreatingDiet] = useState(false);
  const [deletingDietId, setDeletingDietId] = useState<string | null>(null);

  // Fetch all data in parallel for better performance
  const fetchAllData = useCallback(async () => {
    if (!id) return;

    setLoading(true);

    // Reset state to avoid showing stale data
    setClient(null);
    setDietPlans([]);
    setWorkoutPlan(null);
    setWeightHistory([]);

    const [clientResult, dietResult, workoutResult, weightResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single(),
      supabase
        .from('diet_plans')
        .select('*')
        .eq('client_id', id)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('workout_plans')
        .select('*')
        .eq('client_id', id)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('weight_history')
        .select('*')
        .eq('client_id', id)
        .order('recorded_at', { ascending: false })
        .limit(10)
    ]);

    if (clientResult.data) {
      setClient(clientResult.data);
      setPlanStartDate(clientResult.data.plan_start_date || '');
      setPlanEndDate(clientResult.data.plan_end_date || '');
    }

    if (dietResult.data) {
      setDietPlans(dietResult.data);
    }

    if (workoutResult.data?.[0]) {
      setWorkoutPlan(workoutResult.data[0]);
    }

    if (weightResult.data) {
      setWeightHistory(weightResult.data);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  async function handleSavePlanDates() {
    if (!id) return;

    if (planStartDate && planEndDate && new Date(planEndDate) <= new Date(planStartDate)) {
      alert('A data final deve ser posterior a data inicial');
      return;
    }

    setSavingDates(true);

    try {
      await supabase
        .from('profiles')
        .update({
          plan_start_date: planStartDate || null,
          plan_end_date: planEndDate || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      setDatesSaved(true);
      setTimeout(() => setDatesSaved(false), 2000);
    } catch (error) {
      console.error('Error saving plan dates:', error);
    } finally {
      setSavingDates(false);
    }
  }

  // Calculate plan duration for preview
  const planDuration = planStartDate && planEndDate
    ? Math.ceil((new Date(planEndDate).getTime() - new Date(planStartDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  function formatLastUpdated(dateStr: string | null): string {
    if (!dateStr) return 'Não configurado';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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

  async function handleDelete() {
    if (!id) return;

    await supabase.from('profiles').update({ is_active: false }).eq('id', id);

    navigate('/admin', { replace: true });
  }

  async function handleSendPasswordReset() {
    if (!client?.email) {
      alert('Este usuario nao tem email cadastrado.');
      return;
    }

    setSavingPassword(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(client.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setPasswordSuccess(true);
    } catch (error: any) {
      console.error('Error sending reset email:', error);
      alert(error.message || 'Erro ao enviar email de reset');
    } finally {
      setSavingPassword(false);
    }
  }

  function openPasswordModal() {
    setPasswordSuccess(false);
    setShowPasswordModal(true);
  }

  async function handleCreateDiet() {
    if (!id || !newDietName.trim()) return;

    setCreatingDiet(true);

    try {
      const { data, error } = await supabase
        .from('diet_plans')
        .insert({
          client_id: id,
          name: newDietName.trim(),
          display_order: dietPlans.length,
          water_goal_liters: 2,
        })
        .select()
        .single();

      if (error) throw error;

      setDietPlans([...dietPlans, data]);
      setShowNewDietModal(false);
      setNewDietName('');

      // Navigate to the new diet
      navigate(`/admin/aluno/${id}/dieta/${data.id}`);
    } catch (error: any) {
      console.error('Error creating diet:', error);
      alert('Erro ao criar dieta');
    } finally {
      setCreatingDiet(false);
    }
  }

  async function handleDeleteDiet(dietId: string) {
    if (!confirm('Tem certeza que deseja excluir esta dieta? Todas as refeicoes serao perdidas.')) {
      return;
    }

    setDeletingDietId(dietId);

    try {
      const { error } = await supabase
        .from('diet_plans')
        .delete()
        .eq('id', dietId);

      if (error) throw error;

      setDietPlans(dietPlans.filter(d => d.id !== dietId));
    } catch (error: any) {
      console.error('Error deleting diet:', error);
      alert('Erro ao excluir dieta');
    } finally {
      setDeletingDietId(null);
    }
  }

  async function handleDuplicateDiet(diet: DietPlan) {
    setCreatingDiet(true);

    try {
      // 1. Create new diet plan
      const { data: newDiet, error: dietError } = await supabase
        .from('diet_plans')
        .insert({
          client_id: id,
          name: `${diet.name} (Copia)`,
          display_order: dietPlans.length,
          water_goal_liters: diet.water_goal_liters,
          daily_calories: diet.daily_calories,
          protein_g: diet.protein_g,
          carbs_g: diet.carbs_g,
          fat_g: diet.fat_g,
          notes: diet.notes,
        })
        .select()
        .single();

      if (dietError) throw dietError;

      // 2. Copy meals
      const { data: meals } = await supabase
        .from('meals')
        .select('*, meal_foods(*)')
        .eq('diet_plan_id', diet.id);

      if (meals && meals.length > 0) {
        for (const meal of meals) {
          const { data: newMeal } = await supabase
            .from('meals')
            .insert({
              diet_plan_id: newDiet.id,
              name: meal.name,
              suggested_time: meal.suggested_time,
              order_index: meal.order_index,
              meal_substitutions: meal.meal_substitutions,
            })
            .select()
            .single();

          if (newMeal && meal.meal_foods?.length > 0) {
            await supabase
              .from('meal_foods')
              .insert(
                meal.meal_foods.map((f: any) => ({
                  meal_id: newMeal.id,
                  food_name: f.food_name,
                  quantity: f.quantity,
                  quantity_units: f.quantity_units,
                  unit_type: f.unit_type,
                  order_index: f.order_index,
                }))
              );
          }
        }
      }

      // 3. Copy substitutions
      const { data: subs } = await supabase
        .from('food_substitutions')
        .select('*')
        .eq('diet_plan_id', diet.id);

      if (subs && subs.length > 0) {
        await supabase
          .from('food_substitutions')
          .insert(
            subs.map((s: any) => ({
              diet_plan_id: newDiet.id,
              original_food: s.original_food,
              substitute_food: s.substitute_food,
              substitute_quantity: s.substitute_quantity,
            }))
          );
      }

      setDietPlans([...dietPlans, newDiet]);
      alert('Dieta duplicada com sucesso!');
    } catch (error: any) {
      console.error('Error duplicating diet:', error);
      alert('Erro ao duplicar dieta');
    } finally {
      setCreatingDiet(false);
    }
  }

  if (loading) {
    return (
      <PageContainer hasBottomNav={false}>
        <Header title="Carregando..." showBack />
        <div className={styles.loading}>Carregando dados...</div>
      </PageContainer>
    );
  }

  if (!client) {
    return (
      <PageContainer hasBottomNav={false}>
        <Header title="Aluno não encontrado" showBack />
        <div className={styles.loading}>Aluno não encontrado</div>
      </PageContainer>
    );
  }

  const height = client.height_cm ? client.height_cm / 100 : 0;
  const bmi = height > 0 && client.current_weight_kg
    ? client.current_weight_kg / (height * height)
    : 0;
  const startingWeight = client.starting_weight_kg ?? 0;
  const currentWeight = client.current_weight_kg ?? 0;
  const goalWeight = client.goal_weight_kg ?? 0;
  const weightDiff = startingWeight > 0 && currentWeight > 0 ? startingWeight - currentWeight : 0;

  return (
    <PageContainer hasBottomNav={false}>
      <Header title={client.full_name} showBack />

      <main className={styles.content}>
        <Card className={styles.profileCard}>
          <div className={styles.avatar}>
            {client.photo_url ? (
              <img src={client.photo_url} alt="" />
            ) : (
              <span>{client.full_name.charAt(0)}</span>
            )}
          </div>

          {/* Email e Senha */}
          <div className={styles.emailSection}>
            <div className={styles.emailDisplay}>
              <Mail size={16} />
              <span>{client.email || 'Email não cadastrado'}</span>
            </div>
            <button className={styles.passwordButton} onClick={openPasswordModal}>
              <Mail size={16} />
              Redefinir Senha
            </button>
          </div>

          <div className={styles.statsGrid}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Altura</span>
              <span className={styles.statValue}>{height.toFixed(2)}m</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Peso</span>
              <span className={styles.statValue}>{client.current_weight_kg?.toFixed(1) || '-'}kg</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Idade</span>
              <span className={styles.statValue}>{client.age || '-'} anos</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>IMC</span>
              <span className={styles.statValue}>{bmi > 0 ? bmi.toFixed(1) : '-'}</span>
            </div>
          </div>
        </Card>


        {/* Weight Evolution Section */}
        <Card className={styles.weightEvolutionCard}>
          <h3 className={styles.weightEvolutionTitle}>
            <Scale size={20} />
            Evolucao de Peso
          </h3>

          <div className={styles.weightSummary}>
            <div className={styles.weightSummaryItem}>
              <span className={styles.weightSummaryLabel}>Inicial</span>
              <span className={styles.weightSummaryValue}>
                {startingWeight > 0 ? `${startingWeight.toFixed(1)}kg` : '--'}
              </span>
            </div>
            <div className={styles.weightSummaryItem}>
              <span className={styles.weightSummaryLabel}>Atual</span>
              <span className={`${styles.weightSummaryValue} ${styles.weightCurrent}`}>
                {currentWeight > 0 ? `${currentWeight.toFixed(1)}kg` : '--'}
              </span>
            </div>
            <div className={styles.weightSummaryItem}>
              <span className={styles.weightSummaryLabel}>Meta</span>
              <span className={styles.weightSummaryValue}>
                {goalWeight > 0 ? `${goalWeight.toFixed(1)}kg` : '--'}
              </span>
            </div>
          </div>

          {weightDiff !== 0 && currentWeight > 0 && (
            <div className={`${styles.weightDiffBadge} ${weightDiff > 0 ? styles.weightLost : styles.weightGained}`}>
              {weightDiff > 0 ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
              <span>
                {weightDiff > 0
                  ? `Perdeu ${weightDiff.toFixed(1)}kg desde o inicio`
                  : `Ganhou ${Math.abs(weightDiff).toFixed(1)}kg desde o inicio`
                }
              </span>
            </div>
          )}

          {goalWeight > 0 && currentWeight > 0 && (
            <div className={styles.goalRemainingBadge}>
              <Target size={14} />
              <span>
                {Math.abs(currentWeight - goalWeight).toFixed(1)}kg para a meta
              </span>
            </div>
          )}

          {weightHistory.length > 1 && (
            <WeightChart weightHistory={weightHistory} />
          )}

          {weightHistory.length > 0 ? (
            <div className={styles.weightHistoryList}>
              <h4 className={styles.weightHistoryTitle}>Historico Recente</h4>
              {weightHistory.slice(0, 5).map((record, index) => {
                const prevRecord = weightHistory[index + 1];
                const diff = prevRecord ? Number(record.weight_kg) - Number(prevRecord.weight_kg) : 0;

                return (
                  <div key={record.id} className={styles.weightHistoryItem}>
                    <span className={styles.weightHistoryDate}>
                      {new Date(record.recorded_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </span>
                    <div className={styles.weightHistoryRight}>
                      <span className={styles.weightHistoryWeight}>
                        {Number(record.weight_kg).toFixed(1)}kg
                      </span>
                      {diff !== 0 && (
                        <span className={`${styles.weightHistoryTrend} ${diff < 0 ? styles.trendDown : styles.trendUp}`}>
                          {diff < 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                          {Math.abs(diff).toFixed(1)}kg
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.weightEmpty}>
              <p>Nenhum registro de peso</p>
            </div>
          )}
        </Card>

        {/* Plan Dates Section */}
        <Card className={styles.planDatesCard}>
          <h3 className={styles.planDatesTitle}>
            <CalendarDays size={20} />
            Periodo do Plano
          </h3>

          <div className={styles.planDatesGrid}>
            <div className={styles.dateField}>
              <label className={styles.dateLabel}>Data de Inicio</label>
              <input
                type="date"
                value={planStartDate}
                onChange={(e) => setPlanStartDate(e.target.value)}
                className={styles.dateInput}
              />
            </div>
            <div className={styles.dateField}>
              <label className={styles.dateLabel}>Data de Termino</label>
              <input
                type="date"
                value={planEndDate}
                onChange={(e) => setPlanEndDate(e.target.value)}
                className={styles.dateInput}
              />
            </div>
          </div>

          {planDuration > 0 && (
            <div className={styles.planDurationPreview}>
              <span>Duracao do plano: <strong>{planDuration} dias</strong> ({Math.round(planDuration / 7)} semanas)</span>
            </div>
          )}

          <button
            onClick={handleSavePlanDates}
            disabled={savingDates}
            className={`${styles.saveDatesBtn} ${datesSaved ? styles.saved : ''}`}
          >
            {savingDates ? (
              'Salvando...'
            ) : datesSaved ? (
              <>
                <Check size={16} />
                Salvo!
              </>
            ) : (
              'Salvar Datas'
            )}
          </button>
        </Card>

        <div className={styles.menuList}>
          <Link to={`/admin/aluno/${id}/anamnese`} className={styles.menuLink}>
            <Card hoverable className={styles.menuItem}>
              <div className={styles.menuIcon}>
                <ClipboardList size={22} />
              </div>
              <div className={styles.menuContent}>
                <span className={styles.menuText}>Ver Anamnese</span>
              </div>
              <ChevronRight size={20} className={styles.menuArrow} />
            </Card>
          </Link>

          {/* Diets Section */}
          <div className={styles.dietsSection}>
            <div className={styles.dietsSectionHeader}>
              <div className={styles.dietsSectionTitle}>
                <Utensils size={20} />
                <span>Dietas ({dietPlans.length})</span>
              </div>
              <button
                className={styles.addDietButton}
                onClick={() => setShowNewDietModal(true)}
              >
                <Plus size={16} />
                Nova Dieta
              </button>
            </div>

            {dietPlans.length === 0 ? (
              <Card className={styles.noDietsCard}>
                <p>Nenhuma dieta cadastrada</p>
                <Button size="sm" onClick={() => setShowNewDietModal(true)}>
                  <Plus size={16} />
                  Criar Primeira Dieta
                </Button>
              </Card>
            ) : (
              <div className={styles.dietsList}>
                {dietPlans.map((diet) => (
                  <Card key={diet.id} className={styles.dietCard}>
                    <Link
                      to={`/admin/aluno/${id}/dieta/${diet.id}`}
                      className={styles.dietCardLink}
                    >
                      <div className={`${styles.menuIcon} ${styles[getUpdateStatus(diet.updated_at)]}`}>
                        <Utensils size={20} />
                      </div>
                      <div className={styles.dietCardContent}>
                        <span className={styles.dietCardName}>{diet.name}</span>
                        <span className={`${styles.menuStatus} ${styles[getUpdateStatus(diet.updated_at)]}`}>
                          {diet.updated_at ? (
                            <>
                              <Clock size={12} />
                              {formatLastUpdated(diet.updated_at)}
                            </>
                          ) : (
                            <>
                              <AlertCircle size={12} />
                              Nao configurado
                            </>
                          )}
                        </span>
                      </div>
                      <ChevronRight size={18} className={styles.menuArrow} />
                    </Link>
                    <div className={styles.dietCardActions}>
                      <button
                        className={styles.dietActionBtn}
                        onClick={() => handleDuplicateDiet(diet)}
                        disabled={creatingDiet}
                        title="Duplicar dieta"
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        className={`${styles.dietActionBtn} ${styles.dietDeleteBtn}`}
                        onClick={() => handleDeleteDiet(diet.id)}
                        disabled={deletingDietId === diet.id}
                        title="Excluir dieta"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <Link to={`/admin/aluno/${id}/treino`} className={styles.menuLink}>
            <Card hoverable className={styles.menuItem}>
              <div className={`${styles.menuIcon} ${styles[getUpdateStatus(workoutPlan?.updated_at || null)]}`}>
                <Dumbbell size={22} />
              </div>
              <div className={styles.menuContent}>
                <span className={styles.menuText}>Gerenciar Treino</span>
                <span className={`${styles.menuStatus} ${styles[getUpdateStatus(workoutPlan?.updated_at || null)]}`}>
                  {workoutPlan?.updated_at ? (
                    <>
                      <Clock size={12} />
                      Atualizado em {formatLastUpdated(workoutPlan.updated_at)}
                    </>
                  ) : (
                    <>
                      <AlertCircle size={12} />
                      Não configurado
                    </>
                  )}
                </span>
              </div>
              <ChevronRight size={20} className={styles.menuArrow} />
            </Card>
          </Link>

          <Link to={`/admin/aluno/${id}/progressao`} className={styles.menuLink}>
            <Card hoverable className={styles.menuItem}>
              <div className={styles.menuIcon}>
                <TrendingUp size={22} />
              </div>
              <div className={styles.menuContent}>
                <span className={styles.menuText}>Progressao de Cargas</span>
                <span className={styles.menuStatus}>
                  Evolucao de peso por exercicio
                </span>
              </div>
              <ChevronRight size={20} className={styles.menuArrow} />
            </Card>
          </Link>

          <Link to={`/admin/aluno/${id}/orientacoes`} className={styles.menuLink}>
            <Card hoverable className={styles.menuItem}>
              <div className={styles.menuIcon}>
                <FileText size={22} />
              </div>
              <div className={styles.menuContent}>
                <span className={styles.menuText}>Orientações Gerais</span>
                <span className={styles.menuStatus}>
                  Suplementos, manipulados e mais
                </span>
              </div>
              <ChevronRight size={20} className={styles.menuArrow} />
            </Card>
          </Link>
        </div>

        <Button
          variant="danger"
          fullWidth
          onClick={() => setShowDeleteModal(true)}
        >
          <Trash2 size={18} />
          Excluir Aluno
        </Button>
      </main>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Excluir Aluno"
      >
        <div className={styles.deleteModal}>
          <p>Tem certeza que deseja excluir {client.full_name}?</p>
          <p className={styles.deleteWarning}>
            Esta ação irá desativar o aluno e ele não terá mais acesso ao app.
          </p>
          <div className={styles.deleteButtons}>
            <Button variant="ghost" onClick={() => setShowDeleteModal(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Excluir
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Redefinir Senha */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="Redefinir Senha"
      >
        <div className={styles.passwordModal}>
          <p className={styles.passwordEmail}>
            <Mail size={16} />
            {client.email || 'Email nao cadastrado'}
          </p>

          {passwordSuccess ? (
            <div className={styles.passwordSuccess}>
              <Check size={20} />
              <div>
                <strong>Email enviado com sucesso!</strong>
                <p>Um link para redefinir a senha foi enviado para o email do usuario.</p>
              </div>
            </div>
          ) : (
            <>
              <p className={styles.passwordHint}>
                Ao clicar no botao abaixo, um email sera enviado para o usuario com um link para redefinir a senha.
              </p>
              <Button
                fullWidth
                onClick={handleSendPasswordReset}
                loading={savingPassword}
                disabled={!client.email}
              >
                <Mail size={16} />
                Enviar Email de Reset
              </Button>
            </>
          )}

          <div className={styles.passwordModalFooter}>
            <Button variant="ghost" onClick={() => setShowPasswordModal(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Nova Dieta */}
      <Modal
        isOpen={showNewDietModal}
        onClose={() => {
          setShowNewDietModal(false);
          setNewDietName('');
        }}
        title="Nova Dieta"
      >
        <div className={styles.newDietModal}>
          <div className={styles.newDietField}>
            <label>Nome da Dieta</label>
            <Input
              type="text"
              value={newDietName}
              onChange={(e) => setNewDietName(e.target.value)}
              placeholder="Ex: High Carb, Low Carb, Dia de Treino..."
              autoFocus
            />
          </div>
          <div className={styles.newDietButtons}>
            <Button
              variant="ghost"
              onClick={() => {
                setShowNewDietModal(false);
                setNewDietName('');
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateDiet}
              loading={creatingDiet}
              disabled={!newDietName.trim()}
            >
              Criar Dieta
            </Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
