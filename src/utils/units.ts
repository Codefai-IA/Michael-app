import type { Locale, UnitSystem } from '../types/database';

/**
 * Conversao de unidades para EXIBICAO.
 *
 * Regra absoluta do projeto: o banco guarda SEMPRE metrico (kg, cm). unit_system muda
 * apenas (a) como o numero e formatado na tela e (b) como o que o usuario digitou e
 * convertido de volta antes de gravar. Nenhum dado persistido muda de unidade.
 *
 * Macros, gramas de alimento e ml NAO sao convertidos em nenhum dos sistemas: a tabela
 * TACO e toda por-100g, e converter quebraria o calculo de macros, os unit_type, as
 * substituicoes e as equivalencias. Apps de nutricao americanos tambem usam g/kcal.
 */

const LB_PER_KG = 2.20462262185;
const CM_PER_INCH = 2.54;

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

export function cmToFtIn(cm: number): { feet: number; inches: number } {
  const totalInches = cm / CM_PER_INCH;
  const feet = Math.floor(totalInches / 12);
  // arredonda antes de fechar o pe para nao exibir 5'12"
  const inches = Math.round(totalInches - feet * 12);
  if (inches === 12) return { feet: feet + 1, inches: 0 };
  return { feet, inches };
}

export function ftInToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * CM_PER_INCH;
}

/** Numero formatado no separador decimal do locale (pt-BR usa virgula). */
export function formatNumber(value: number, locale: Locale, digits = 1): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Peso corporal. Recebe SEMPRE kg (como esta no banco). */
export function formatWeight(kg: number, system: UnitSystem, locale: Locale, digits = 1): string {
  return system === 'imperial'
    ? `${formatNumber(kgToLb(kg), locale, digits)} lb`
    : `${formatNumber(kg, locale, digits)} kg`;
}

/** Altura. Recebe SEMPRE cm. */
export function formatHeight(cm: number, system: UnitSystem): string {
  if (system === 'imperial') {
    const { feet, inches } = cmToFtIn(cm);
    return `${feet}'${inches}"`;
  }
  return `${Math.round(cm)} cm`;
}

/** Carga de exercicio. Recebe SEMPRE kg. Sem casas decimais quando redondo. */
export function formatLoad(kg: number, system: UnitSystem, locale: Locale): string {
  const value = system === 'imperial' ? kgToLb(kg) : kg;
  const digits = Number.isInteger(value) ? 0 : 1;
  const unit = system === 'imperial' ? 'lb' : 'kg';
  return `${formatNumber(value, locale, digits)} ${unit}`;
}

/**
 * Le o que o usuario digitou e devolve kg para gravar.
 * Aceita virgula e ponto: o aluno en digita "154.3", o pt-BR digita "72,5".
 * Devolve null quando nao da para interpretar — o chamador decide o que fazer,
 * em vez de gravar 0 silenciosamente.
 */
export function parseWeightInput(input: string, system: UnitSystem): number | null {
  const cleaned = input.trim().replace(',', '.');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const kg = system === 'imperial' ? lbToKg(parsed) : parsed;
  return Math.round(kg * 100) / 100; // 2 casas: evita drift lb->kg->lb no historico
}

/** Idem para altura: devolve cm. No imperial o input e em polegadas totais. */
export function parseHeightInput(input: string, system: UnitSystem): number | null {
  const cleaned = input.trim().replace(',', '.');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const cm = system === 'imperial' ? parsed * CM_PER_INCH : parsed;
  return Math.round(cm * 10) / 10;
}

/** Rotulos curtos para labels e placeholders de formulario. */
export function weightUnitLabel(system: UnitSystem): string {
  return system === 'imperial' ? 'lb' : 'kg';
}

export function heightUnitLabel(system: UnitSystem): string {
  return system === 'imperial' ? 'in' : 'cm';
}
