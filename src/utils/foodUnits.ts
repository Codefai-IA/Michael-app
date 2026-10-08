import type { UnitType, TabelaTacoWithMetadata } from '../types/database';
import { UNIT_TYPES } from '../constants/foodUnits';
import { formatFoodName } from './formatters';
import type { TKey } from '../i18n';

/**
 * Calculate grams from units
 */
export function calculateGramsFromUnits(units: number, pesoPorUnidade: number): number {
  return units * pesoPorUnidade;
}

/**
 * Calculate units from grams
 */
export function calculateUnitsFromGrams(grams: number, pesoPorUnidade: number): number {
  if (pesoPorUnidade <= 0) return 0;
  return grams / pesoPorUnidade;
}

/**
 * Format quantity for display
 * Returns "2 fatias (60g)" or "100g"
 */
export function formatQuantityDisplay(
  grams: number,
  units: number | null,
  unitType: UnitType,
  // O admin usa o padrao (pt-BR fixo); o app do aluno passa o rotulo traduzido.
  unitLabel: (unitType: UnitType, quantity: number) => string = getUnitLabel
): string {
  if (unitType === 'gramas' || units === null || units === 0) {
    return `${grams}g`;
  }

  return `${units} ${unitLabel(unitType, units)} (${Math.round(grams)}g)`;
}

/**
 * Get display name for a food (simplified name if available, otherwise formatted original)
 */
export function getDisplayName(food: TabelaTacoWithMetadata): string {
  if (food.food_metadata?.nome_simplificado) {
    return food.food_metadata.nome_simplificado;
  }
  return formatFoodName(food.alimento);
}

/**
 * Get unit label for display
 */
export function getUnitLabel(unitType: UnitType, quantity: number = 1): string {
  const unitInfo = UNIT_TYPES[unitType];
  return quantity === 1 ? unitInfo.singular : unitInfo.plural;
}

const UNIT_LABEL_KEYS: Record<Exclude<UnitType, 'gramas' | 'ml'>, { one: TKey; other: TKey }> = {
  unidade: { one: 'units.unidade.one', other: 'units.unidade.other' },
  fatia: { one: 'units.fatia.one', other: 'units.fatia.other' },
  colher_sopa: { one: 'units.colher_sopa.one', other: 'units.colher_sopa.other' },
  colher_cha: { one: 'units.colher_cha.one', other: 'units.colher_cha.other' },
  xicara: { one: 'units.xicara.one', other: 'units.xicara.other' },
  copo: { one: 'units.copo.one', other: 'units.copo.other' },
  porcao: { one: 'units.porcao.one', other: 'units.porcao.other' },
};

/**
 * Rotulo de unidade no idioma do aluno. Recebe o `t` do useI18n; so para o app do aluno —
 * o admin continua com getUnitLabel (pt-BR). Em pt-BR devolve exatamente o mesmo texto.
 */
export function getLocalizedUnitLabel(
  t: (key: TKey) => string,
  unitType: UnitType,
  quantity: number = 1
): string {
  if (unitType === 'gramas') return 'g';
  if (unitType === 'ml') return 'ml';
  const keys = UNIT_LABEL_KEYS[unitType];
  if (!keys) return getUnitLabel(unitType, quantity);
  return t(quantity === 1 ? keys.one : keys.other);
}

/**
 * Check if a food has unit support (metadata with unit defined)
 */
export function hasUnitSupport(food: TabelaTacoWithMetadata): boolean {
  return !!(
    food.food_metadata &&
    food.food_metadata.unidade_tipo !== 'gramas' &&
    food.food_metadata.peso_por_unidade &&
    food.food_metadata.peso_por_unidade > 0
  );
}
