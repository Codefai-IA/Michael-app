import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { usePageData } from './usePageData';
import { buildTacoIndex, type ShoppingFoodInput, type ShoppingMealInput, type TacoIndex, type TacoRow, type UnitWeights } from '../utils/shoppingList';
import type { DietPlan, MealSubstitution, UnitType } from '../types/database';

/** Mesma chave da tela de Dieta (Diet.tsx): a lista usa a dieta que o aluno deixou selecionada la. */
const SELECTED_DIET_KEY = 'selectedDietId';
// Teto de linhas por request do PostgREST: sem paginar, o servidor corta em silencio.
const TACO_PAGE = 1000;

export interface ShoppingMeal extends ShoppingMealInput {
  name: string;
  /** Nome de cada opcao (indice 0 = Opcao 1, sem nome). */
  optionNames: (string | null)[];
}

interface MealRow {
  id: string;
  name: string;
  order_index: number | null;
  meal_substitutions: MealSubstitution[] | null;
  meal_foods: { food_name: string; quantity: string; unit_type: UnitType | null; quantity_units: number | null; order_index: number | null }[] | null;
}

function readStoredDietId(): string | null {
  try { return localStorage.getItem(SELECTED_DIET_KEY); } catch { return null; }
}
function writeStoredDietId(id: string) {
  try { localStorage.setItem(SELECTED_DIET_KEY, id); } catch { /* sem storage */ }
}

async function fetchTaco(): Promise<{ rows: TacoRow[]; simpleNames: Map<string, string>; unitWeights: UnitWeights }> {
  const rows: TacoRow[] = [];
  const simpleNames = new Map<string, string>();
  const unitWeights: UnitWeights = new Map();
  for (let from = 0; ; from += TACO_PAGE) {
    const { data, error } = await supabase
      .from('tabela_taco')
      .select('id, alimento, caloria, food_metadata ( nome_simplificado, unidade_tipo, peso_por_unidade )')
      .order('id', { ascending: true })
      .range(from, from + TACO_PAGE - 1);
    if (error) throw error;
    for (const r of data ?? []) {
      rows.push({ id: r.id, alimento: r.alimento, caloria: r.caloria });
      const meta = Array.isArray(r.food_metadata) ? r.food_metadata[0] : r.food_metadata;
      if (meta?.nome_simplificado) simpleNames.set(r.alimento, meta.nome_simplificado);
      // So "unidade" (ovo, pao frances). "Fatia" no cadastro nem sempre e como se compra (requeijao
      // cremoso esta como fatia): fica em gramas, a nao ser que a propria dieta esteja em fatias.
      if (meta?.unidade_tipo === 'unidade' && Number(meta.peso_por_unidade) > 0) {
        unitWeights.set(r.alimento, { unit: 'unidade', grams: Number(meta.peso_por_unidade) });
      }
    }
    if (!data || data.length < TACO_PAGE) break;
  }
  return { rows, simpleNames, unitWeights };
}

const toInput = (f: { food_name: string; quantity: string | number | null; unit_type: UnitType | null; quantity_units: number | null }): ShoppingFoodInput => ({
  food_name: f.food_name,
  quantity: f.quantity,
  unit_type: f.unit_type,
  quantity_units: f.quantity_units,
});

/** Dieta do aluno + tabela de alimentos, no formato da lista de compras. */
export function useShoppingDiet(userId: string | undefined) {
  const [diets, setDiets] = useState<DietPlan[]>([]);
  const [dietId, setDietId] = useState<string | null>(null);
  const [meals, setMeals] = useState<ShoppingMeal[]>([]);
  const [taco, setTaco] = useState<TacoIndex>(new Map());
  const [simpleNames, setSimpleNames] = useState<Map<string, string>>(new Map());
  const [unitWeights, setUnitWeights] = useState<UnitWeights>(new Map());
  const [error, setError] = useState(false);

  const loadMeals = useCallback(async (id: string) => {
    // Mesma consulta aninhada da tela de Dieta (passa pelas mesmas regras de acesso).
    const { data, error: mealsError } = await supabase
      .from('diet_plans')
      .select('id, meals ( id, name, order_index, meal_substitutions, meal_foods ( food_name, quantity, unit_type, quantity_units, order_index ) )')
      .eq('id', id)
      .single();
    if (mealsError) throw mealsError;
    const rows = [...((data?.meals ?? []) as MealRow[])].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    setMeals(rows.map((m) => {
      const subs = (m.meal_substitutions ?? []).filter((s) => Array.isArray(s?.items));
      return {
        id: m.id,
        name: m.name,
        foods: [...(m.meal_foods ?? [])].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)).map(toInput),
        options: subs.map((s) => s.items.map(toInput)),
        optionNames: [null, ...subs.map((s) => s.name || null)],
      };
    }));
  }, []);

  const fetchAll = useCallback(async () => {
    if (!userId) return;
    try {
      setError(false);
      const [dietsRes, tacoRes] = await Promise.all([
        supabase
          .from('diet_plans')
          .select('*')
          .eq('client_id', userId)
          .order('display_order', { ascending: true })
          .order('created_at', { ascending: true }),
        fetchTaco(),
      ]);
      if (dietsRes.error) throw dietsRes.error;
      const list = (dietsRes.data ?? []) as DietPlan[];
      setDiets(list);
      setTaco(buildTacoIndex(tacoRes.rows));
      setSimpleNames(tacoRes.simpleNames);
      setUnitWeights(tacoRes.unitWeights);
      if (list.length === 0) {
        setDietId(null);
        setMeals([]);
        return;
      }
      const stored = readStoredDietId();
      const chosen = list.find((d) => d.id === stored) ?? list[0];
      setDietId(chosen.id);
      await loadMeals(chosen.id);
    } catch (e) {
      console.error('[ShoppingList] erro ao carregar a dieta:', e);
      setError(true);
    }
  }, [userId, loadMeals]);

  const { isInitialLoading } = usePageData({ userId, fetchData: fetchAll });

  const changeDiet = useCallback(async (id: string) => {
    setDietId(id);
    writeStoredDietId(id);
    try {
      await loadMeals(id);
    } catch (e) {
      console.error('[ShoppingList] erro ao trocar a dieta:', e);
      setError(true);
    }
  }, [loadMeals]);

  return { loading: isInitialLoading, error, diets, dietId, changeDiet, meals, taco, simpleNames, unitWeights };
}
