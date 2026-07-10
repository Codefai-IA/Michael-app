import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Utensils, Dumbbell, Bell } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { diffDietMeals, type MealDiff } from '../../utils/dietDiff';
import { formatQuantityDisplay } from '../../utils/foodUnits';
import { formatFoodName } from '../../utils/formatters';
import { parseBrazilianNumber } from './FoodSelect';
import type { DietRevisionSnapshot, DietRevisionSnapshotFood } from '../../types/database';
import styles from './PlanUpdatedModal.module.css';

/**
 * Popup in-app que avisa o aluno quando a dieta e/ou o treino foram atualizados
 * pelo nutricionista. Compara o `updated_at` do plano com o "último visto"
 * guardado no localStorage (padrão da casa, igual ao WeeklyReportModal).
 *
 * Na primeira vez (sem valor salvo) apenas registra a data como baseline,
 * sem mostrar o popup — assim ninguém é notificado de dietas/treinos antigos.
 *
 * Quando a dieta muda, também mostra O QUE mudou (ex.: Arroz 100g → 150g),
 * comparando o snapshot pré-salvamento (diet_plan_revisions) com a dieta
 * atual, e um resumo dos macros de como a dieta ficou.
 */

interface PlanMacros {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
}

interface PlanDiffView {
  planId: string;
  planName: string;
  mealDiffs: MealDiff[];
  macrosBefore: PlanMacros | null;
  macrosAfter: PlanMacros;
}

function macrosFromPlanRow(row: {
  daily_calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}): PlanMacros {
  return {
    calories: row.daily_calories,
    protein: row.protein_g,
    carbs: row.carbs_g,
    fats: row.fat_g,
  };
}

function macrosDiffer(a: PlanMacros | null, b: PlanMacros): boolean {
  if (!a) return false;
  return (
    a.calories !== b.calories || a.protein !== b.protein || a.carbs !== b.carbs || a.fats !== b.fats
  );
}

/** Monta os diffs por plano a partir dos planos alterados + snapshots de revisão */
async function fetchDietDiffs(
  clientId: string,
  dietSeen: string
): Promise<{ diffs: PlanDiffView[]; names: Map<string, string> }> {
  const [{ data: changedPlans }, { data: revisions }] = await Promise.all([
    supabase
      .from('diet_plans')
      .select(
        'id, name, daily_calories, protein_g, carbs_g, fat_g, meals(id, name, order_index, meal_foods(id, food_name, quantity, unit_type, quantity_units, order_index))'
      )
      .eq('client_id', clientId)
      .gt('updated_at', dietSeen),
    supabase
      .from('diet_plan_revisions')
      .select('diet_plan_id, snapshot, created_at')
      .eq('client_id', clientId)
      .gt('created_at', dietSeen)
      .order('created_at', { ascending: true }),
  ]);

  // Baseline = a revisão MAIS ANTIGA depois do "último visto": o snapshot dela
  // é o estado da dieta como o aluno viu por último.
  const baselineByPlan = new Map<string, DietRevisionSnapshot>();
  (revisions || []).forEach((rev: { diet_plan_id: string; snapshot: DietRevisionSnapshot }) => {
    if (!baselineByPlan.has(rev.diet_plan_id)) {
      baselineByPlan.set(rev.diet_plan_id, rev.snapshot);
    }
  });

  const diffs: PlanDiffView[] = [];
  for (const plan of changedPlans || []) {
    const baseline = baselineByPlan.get(plan.id);
    if (!baseline) continue; // sem snapshot (ex.: salvamento anterior à feature)

    // Dieta montada do zero (baseline sem alimentos): listar tudo como
    // "adicionado" viraria um resumo da dieta inteira — cai no popup genérico
    const baselineFoodCount = (baseline.meals || []).reduce(
      (sum, meal) => sum + (meal.meal_foods || []).filter((f) => f.food_name).length,
      0
    );
    if (baselineFoodCount === 0) continue;

    const mealDiffs = diffDietMeals(baseline.meals || [], plan.meals || []);
    const macrosAfter = macrosFromPlanRow(plan);
    const macrosBefore = baseline.plan ? macrosFromPlanRow(baseline.plan) : null;

    // Salvamento sem mudança real (updated_at bumpado, nada alterado): pula
    if (mealDiffs.length === 0 && !macrosDiffer(macrosBefore, macrosAfter)) continue;

    diffs.push({ planId: plan.id, planName: plan.name, mealDiffs, macrosBefore, macrosAfter });
  }

  // Nomes amigáveis (nome_simplificado do food_metadata, como na página da dieta)
  const names = new Map<string, string>();
  const foodNames = new Set<string>();
  diffs.forEach((view) =>
    view.mealDiffs.forEach((md) =>
      md.changes.forEach((c) => {
        if (c.before?.food_name) foodNames.add(c.before.food_name);
        if (c.after?.food_name) foodNames.add(c.after.food_name);
      })
    )
  );
  if (foodNames.size > 0) {
    const { data: tacoData } = await supabase
      .from('tabela_taco')
      .select('alimento, food_metadata(nome_simplificado)')
      .in('alimento', Array.from(foodNames));
    type TacoNameRow = {
      alimento: string;
      // food_metadata pode vir como array ou objeto dependendo da relação
      food_metadata:
        | { nome_simplificado: string | null }
        | { nome_simplificado: string | null }[]
        | null;
    };
    (tacoData || []).forEach((item: TacoNameRow) => {
      const metadata = Array.isArray(item.food_metadata) ? item.food_metadata[0] : item.food_metadata;
      if (metadata?.nome_simplificado) names.set(item.alimento, metadata.nome_simplificado);
    });
  }

  return { diffs, names };
}

export function PlanUpdatedModal() {
  const { user, profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  // Guarda o updated_at pendente de cada tipo (null = sem novidade)
  const [pending, setPending] = useState<{ diet: string | null; workout: string | null }>({
    diet: null,
    workout: null,
  });
  const [dietDiffs, setDietDiffs] = useState<PlanDiffView[]>([]);
  const [displayNames, setDisplayNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!user || isAdmin || !profile) return;
    let cancelled = false;

    (async () => {
      const clientId = profile.id;
      const [{ data: diet }, { data: workout }] = await Promise.all([
        supabase
          .from('diet_plans')
          .select('updated_at')
          .eq('client_id', clientId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('workout_plans')
          .select('updated_at')
          .eq('client_id', clientId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const dietUpd = diet?.updated_at ?? null;
      const workoutUpd = workout?.updated_at ?? null;
      const dietKey = `diet-seen-${user.id}`;
      const workoutKey = `workout-seen-${user.id}`;
      const dietSeen = localStorage.getItem(dietKey);
      const workoutSeen = localStorage.getItem(workoutKey);

      // Baseline na primeira vez: registra sem mostrar o popup
      if (dietUpd && !dietSeen) localStorage.setItem(dietKey, dietUpd);
      if (workoutUpd && !workoutSeen) localStorage.setItem(workoutKey, workoutUpd);

      const dietChanged = !!(
        dietUpd &&
        dietSeen &&
        new Date(dietUpd).getTime() > new Date(dietSeen).getTime()
      );
      const workoutChanged = !!(
        workoutUpd &&
        workoutSeen &&
        new Date(workoutUpd).getTime() > new Date(workoutSeen).getTime()
      );

      // O diff é opcional: se falhar, o popup genérico continua funcionando
      let diffs: PlanDiffView[] = [];
      let names = new Map<string, string>();
      if (dietChanged && dietSeen) {
        try {
          ({ diffs, names } = await fetchDietDiffs(clientId, dietSeen));
        } catch (err) {
          console.error('Error building diet diff:', err);
        }
      }

      if (cancelled) return;

      if (dietChanged || workoutChanged) {
        setPending({
          diet: dietChanged ? dietUpd : null,
          workout: workoutChanged ? workoutUpd : null,
        });
        setDietDiffs(diffs);
        setDisplayNames(names);
        setShow(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, profile, isAdmin]);

  // Marca como visto tudo que estava pendente (evita reaparecer até a próxima atualização)
  function markSeen() {
    if (!user) return;
    if (pending.diet) localStorage.setItem(`diet-seen-${user.id}`, pending.diet);
    if (pending.workout) localStorage.setItem(`workout-seen-${user.id}`, pending.workout);
  }

  function goToDiet() {
    markSeen();
    setShow(false);
    navigate('/app/dieta');
  }

  function goToWorkout() {
    markSeen();
    setShow(false);
    navigate('/app/treino');
  }

  function handleClose() {
    markSeen();
    setShow(false);
  }

  function foodLabel(food: DietRevisionSnapshotFood): string {
    return displayNames.get(food.food_name) || formatFoodName(food.food_name);
  }

  function qtyLabel(food: DietRevisionSnapshotFood): string {
    return formatQuantityDisplay(
      Math.round(parseBrazilianNumber(food.quantity)),
      food.quantity_units,
      food.unit_type || 'gramas'
    );
  }

  if (!show) return null;

  const both = !!pending.diet && !!pending.workout;
  const hasDiff = !!pending.diet && dietDiffs.length > 0;
  const title = both
    ? 'Novidades pra você!'
    : pending.diet
    ? 'Dieta atualizada!'
    : 'Treino atualizado!';
  const subtitle = both
    ? 'Seu nutricionista atualizou sua dieta e seu treino. Confira agora!'
    : pending.diet
    ? hasDiff
      ? 'Seu nutricionista atualizou sua dieta. Veja o que mudou:'
      : 'Seu nutricionista atualizou sua dieta. Confira agora!'
    : 'Seu treinador atualizou seu treino. Confira agora!';

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.iconCircle}>
          <Bell size={30} strokeWidth={2.25} />
        </div>

        <h2 className={styles.title}>{title}</h2>
        <p className={styles.subtitle}>{subtitle}</p>

        {hasDiff && (
          <div className={styles.changes}>
            {dietDiffs.map((plan) => (
              <div key={plan.planId}>
                {dietDiffs.length > 1 && <div className={styles.planName}>{plan.planName}</div>}

                {plan.mealDiffs.map((mealDiff) => (
                  <div key={mealDiff.mealName} className={styles.mealGroup}>
                    <div className={styles.mealName}>{mealDiff.mealName}</div>
                    {mealDiff.changes.map((change, i) => {
                      if (change.kind === 'changed' && change.before && change.after) {
                        return (
                          <div key={i} className={styles.changeLine}>
                            <span className={styles.foodName}>{foodLabel(change.after)}</span>
                            <span className={styles.qtyOld}>{qtyLabel(change.before)}</span>
                            <span className={styles.arrow}>→</span>
                            <span className={styles.qtyNew}>{qtyLabel(change.after)}</span>
                          </div>
                        );
                      }
                      if (change.kind === 'swapped' && change.before && change.after) {
                        return (
                          <div key={i} className={styles.changeLine}>
                            <span className={styles.qtyOld}>{foodLabel(change.before)}</span>
                            <span className={styles.arrow}>→</span>
                            <span className={styles.qtyNew}>
                              {foodLabel(change.after)} ({qtyLabel(change.after)})
                            </span>
                          </div>
                        );
                      }
                      if (change.kind === 'added' && change.after) {
                        return (
                          <div key={i} className={`${styles.changeLine} ${styles.added}`}>
                            <span>
                              + {foodLabel(change.after)} — {qtyLabel(change.after)}
                            </span>
                          </div>
                        );
                      }
                      if (change.kind === 'removed' && change.before) {
                        return (
                          <div key={i} className={`${styles.changeLine} ${styles.removed}`}>
                            <span>− {foodLabel(change.before)}</span>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                ))}

                <div className={styles.macroSummary}>
                  <div className={styles.macroTitle}>Como sua dieta ficou</div>
                  <MacroRow
                    label="🔥 Calorias"
                    unit=" kcal"
                    before={plan.macrosBefore?.calories ?? null}
                    after={plan.macrosAfter.calories}
                  />
                  <MacroRow
                    label="🥩 Proteínas"
                    unit="g"
                    before={plan.macrosBefore?.protein ?? null}
                    after={plan.macrosAfter.protein}
                  />
                  <MacroRow
                    label="🍞 Carboidratos"
                    unit="g"
                    before={plan.macrosBefore?.carbs ?? null}
                    after={plan.macrosAfter.carbs}
                  />
                  <MacroRow
                    label="🥑 Gorduras"
                    unit="g"
                    before={plan.macrosBefore?.fats ?? null}
                    after={plan.macrosAfter.fats}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className={styles.actions}>
          {pending.diet && (
            <button onClick={goToDiet} className={styles.primaryBtn}>
              <Utensils size={18} />
              Ver minha dieta
            </button>
          )}
          {pending.workout && (
            <button
              onClick={goToWorkout}
              className={pending.diet ? styles.secondaryBtn : styles.primaryBtn}
            >
              <Dumbbell size={18} />
              Ver meu treino
            </button>
          )}
        </div>

        <button onClick={handleClose} className={styles.dismissBtn}>
          Agora não
        </button>
      </div>
    </div>
  );
}

/** Linha do resumo de macros: "1800 → 2000 kcal (+200)" ou só "2000 kcal" */
function MacroRow({
  label,
  unit,
  before,
  after,
}: {
  label: string;
  unit: string;
  before: number | null;
  after: number | null;
}) {
  if (after === null && before === null) return null;

  const changed = before !== null && after !== null && before !== after;
  const delta = changed ? (after as number) - (before as number) : 0;

  return (
    <div className={styles.macroRow}>
      <span className={styles.macroLabel}>{label}</span>
      <span className={styles.macroValue}>
        {changed ? (
          <>
            <span className={styles.qtyOld}>
              {before}
              {unit}
            </span>
            <span className={styles.arrow}>→</span>
            <span className={styles.qtyNew}>
              {after}
              {unit}
            </span>
            <span className={styles.macroDelta}>
              ({delta > 0 ? '+' : ''}
              {delta}
              {unit})
            </span>
          </>
        ) : (
          <span className={styles.qtyNew}>
            {after ?? before}
            {unit}
          </span>
        )}
      </span>
    </div>
  );
}
