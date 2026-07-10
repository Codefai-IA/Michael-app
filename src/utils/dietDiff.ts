import type { DietRevisionSnapshotFood, DietRevisionSnapshotMeal } from '../types/database';
import { parseBrazilianNumber } from '../components/ui/FoodSelect';

/**
 * Comparação entre o snapshot da dieta (o que o aluno viu por último) e o
 * estado atual, para o popup "Dieta atualizada" mostrar o que mudou.
 *
 * Os alimentos são casados pelo id da linha em meal_foods:
 *  - mesmo id + mesmo alimento + quantidade diferente → 'changed' (100g → 150g)
 *  - mesmo id + alimento diferente → 'swapped' (Arroz → Batata doce)
 *  - id só no estado atual → 'added'
 *  - id só no snapshot → 'removed'
 */

export type DietChangeKind = 'changed' | 'swapped' | 'added' | 'removed';

export interface DietChange {
  kind: DietChangeKind;
  before?: DietRevisionSnapshotFood;
  after?: DietRevisionSnapshotFood;
}

export interface MealDiff {
  mealName: string;
  changes: DietChange[];
}

function sameQuantity(a: DietRevisionSnapshotFood, b: DietRevisionSnapshotFood): boolean {
  return (
    parseBrazilianNumber(a.quantity) === parseBrazilianNumber(b.quantity) &&
    (a.quantity_units ?? null) === (b.quantity_units ?? null) &&
    (a.unit_type || 'gramas') === (b.unit_type || 'gramas')
  );
}

export function diffDietMeals(
  before: DietRevisionSnapshotMeal[],
  after: DietRevisionSnapshotMeal[]
): MealDiff[] {
  const beforeFoodById = new Map<string, DietRevisionSnapshotFood>();
  const beforeMealNameByFoodId = new Map<string, string>();
  (before || []).forEach((meal) => {
    (meal.meal_foods || []).forEach((food) => {
      if (!food.food_name) return; // linha em branco no editor do admin
      beforeFoodById.set(food.id, food);
      beforeMealNameByFoodId.set(food.id, meal.name);
    });
  });

  const matchedIds = new Set<string>();
  const diffs: MealDiff[] = [];

  function diffForMeal(mealName: string): MealDiff {
    let entry = diffs.find((d) => d.mealName === mealName);
    if (!entry) {
      entry = { mealName, changes: [] };
      diffs.push(entry);
    }
    return entry;
  }

  const sortedAfter = [...(after || [])].sort(
    (a, b) => (a.order_index || 0) - (b.order_index || 0)
  );

  for (const meal of sortedAfter) {
    const sortedFoods = [...(meal.meal_foods || [])].sort(
      (a, b) => (a.order_index || 0) - (b.order_index || 0)
    );
    for (const food of sortedFoods) {
      if (!food.food_name) continue;

      const prev = beforeFoodById.get(food.id);
      if (!prev) {
        diffForMeal(meal.name).changes.push({ kind: 'added', after: food });
        continue;
      }

      matchedIds.add(food.id);
      if (prev.food_name !== food.food_name) {
        diffForMeal(meal.name).changes.push({ kind: 'swapped', before: prev, after: food });
      } else if (!sameQuantity(prev, food)) {
        diffForMeal(meal.name).changes.push({ kind: 'changed', before: prev, after: food });
      }
    }
  }

  // Removidos: estavam no snapshot e não existem mais na dieta atual
  beforeFoodById.forEach((food, foodId) => {
    if (matchedIds.has(foodId)) return;
    const mealName = beforeMealNameByFoodId.get(foodId) || '';
    diffForMeal(mealName).changes.push({ kind: 'removed', before: food });
  });

  return diffs.filter((d) => d.changes.length > 0);
}
