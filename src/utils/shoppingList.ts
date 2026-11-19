import type { UnitType } from '../types/database';

/**
 * Lista de compras do aluno (pedido do Michael, 19/11/2026): soma os alimentos da dieta pelos dias escolhidos,
 * separa por secao do mercado e converte o peso pronto em peso cru (o que se compra).
 *
 * Funcoes puras, sem React nem Supabase: testadas em scripts/check-shopping-list.mjs.
 *
 * Regras de dados (iguais a tela de Dieta):
 *  - A dieta e um plano de UM dia que se repete. `quantity` e texto em gramas ("120" ou "120,5"); em ml quando
 *    unit_type = 'ml'. `quantity_units` guarda "2 fatias", "3 unidades".
 *  - A chave e sempre o `food_name` cru do banco. Nunca o nome traduzido (regra do i18n: traduzir antes de
 *    somar junta/separa alimentos errado).
 */

export type ShoppingCategory =
  | 'proteinas'
  | 'bases'
  | 'frutas'
  | 'legumes'
  | 'laticinios'
  | 'complementos'
  | 'outros';

/** Ordem das secoes na tela. */
export const SHOPPING_CATEGORIES: ShoppingCategory[] = [
  'proteinas',
  'bases',
  'frutas',
  'legumes',
  'laticinios',
  'complementos',
  'outros',
];

export const PERIOD_OPTIONS = [7, 15, 30] as const;
export type PeriodDays = (typeof PERIOD_OPTIONS)[number];
export const DAYS_PER_WEEK = 7;

export interface ShoppingFoodInput {
  food_name: string;
  quantity: string | number | null;
  unit_type: UnitType | null;
  quantity_units: number | null;
}

export interface ShoppingMealInput {
  id: string;
  /** Opcao 1 (meal_foods). */
  foods: ShoppingFoodInput[];
  /** Opcao 2, 3... (meal_substitutions[].items). */
  options: ShoppingFoodInput[][];
}

export interface TacoRow {
  id: number;
  alimento: string;
  caloria: string | number | null;
}

/** Indice da tabela_taco por nome normalizado. */
export type TacoIndex = Map<string, { id: number; kcal: number }>;

export type ShoppingAmount =
  | { kind: 'grams'; grams: number; cookedGrams: number | null }
  | { kind: 'ml'; ml: number }
  | { kind: 'count'; unit: 'unidade' | 'fatia'; count: number; grams: number }
  | { kind: 'portions'; count: number };

export interface ShoppingItem {
  /** food_name do banco: chave da marcacao e da traducao. */
  key: string;
  category: ShoppingCategory;
  amount: ShoppingAmount;
  /** "PORCAO DE FRUTA": o aluno escolhe qual comprar. */
  generic: boolean;
}

export function parseQty(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const n = parseFloat(value.toString().replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** Minusculas, sem espacos duplicados (a TACO tem "Coco,  verde" e espaco no fim). */
export function tacoKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function buildTacoIndex(rows: TacoRow[]): TacoIndex {
  const index: TacoIndex = new Map();
  for (const r of rows) {
    if (!r.alimento) continue;
    index.set(tacoKey(r.alimento), { id: r.id, kcal: parseQty(r.caloria) });
  }
  return index;
}

// ---------------------------------------------------------------------------------------------
// Categoria
// ---------------------------------------------------------------------------------------------

/**
 * Os ids 1-597 da tabela_taco seguem a ordem oficial da TACO (4a edicao), que e agrupada.
 * Fronteiras conferidas no banco em 19/11/2026.
 */
const TACO_RANGES: { from: number; to: number; category: ShoppingCategory }[] = [
  { from: 1, to: 63, category: 'bases' }, // cereais e derivados
  { from: 64, to: 162, category: 'legumes' }, // verduras, hortalicas
  { from: 163, to: 258, category: 'frutas' },
  { from: 259, to: 272, category: 'complementos' }, // gorduras e oleos
  { from: 273, to: 322, category: 'proteinas' }, // pescados
  { from: 323, to: 445, category: 'proteinas' }, // carnes
  { from: 446, to: 469, category: 'laticinios' },
  { from: 470, to: 483, category: 'outros' }, // bebidas
  { from: 484, to: 490, category: 'proteinas' }, // ovos
  { from: 491, to: 511, category: 'outros' }, // produtos acucarados
  { from: 512, to: 524, category: 'complementos' }, // miscelaneas e industrializados (fermento, shoyu, tempero)
  { from: 525, to: 556, category: 'outros' }, // alimentos preparados
  { from: 557, to: 586, category: 'bases' }, // leguminosas
  { from: 587, to: 597, category: 'complementos' }, // nozes e sementes
];

/** Alimentos criados pelo Michael (ids 598+). Alimento novo sem entrada cai em "outros". */
const CUSTOM_CATEGORY: Record<number, ShoppingCategory> = {
  609: 'proteinas', 610: 'proteinas', 611: 'proteinas', 612: 'proteinas', 613: 'proteinas', 614: 'proteinas',
  615: 'proteinas', 616: 'proteinas', 617: 'proteinas', 649: 'proteinas', 657: 'proteinas', 658: 'proteinas',
  659: 'proteinas', 661: 'proteinas', 662: 'proteinas', 664: 'proteinas', 673: 'proteinas', 691: 'proteinas',
  693: 'proteinas',
  629: 'bases', 630: 'bases', 651: 'bases', 652: 'bases', 653: 'bases', 654: 'bases', 655: 'bases', 656: 'bases',
  660: 'bases', 669: 'bases', 672: 'bases', 690: 'bases', 695: 'bases', 696: 'bases', 697: 'bases', 698: 'bases',
  650: 'frutas', 689: 'frutas',
  663: 'legumes',
  665: 'laticinios', 666: 'laticinios', 667: 'laticinios', 685: 'laticinios', 686: 'laticinios', 687: 'laticinios',
  699: 'laticinios',
  668: 'complementos', 671: 'complementos', 674: 'complementos', 694: 'complementos',
};

// Tuberculos ficam no grupo de verduras da TACO, mas no prato sao a base da refeicao.
// \b do JS nao entende letra acentuada ("cará"): fronteira feita com \p{L}.
const TUBER_RE = /(^|[^\p{L}])(batata|mandioca|aipim|macaxeira|inhame|car[aá]|mandioquinha|baroa)(?![\p{L}])/u;
// Amendoim esta nas leguminosas da TACO, mas e gordura (complemento).
const PEANUT_RE = /\bamendoim\b/;
// Doces e salgadinhos do grupo de cereais nao sao base de refeicao.
const SNACK_RE = /(biscoito.*(doce|recheado|wafer)|\bbolo\b|\bpizza\b|salgadinho|\bpipoca\b)/;
const PREPARED_FROM = 525;
const PREPARED_TO = 556;
const TOFU_RE = /\btofu\b/;
const BROTH_RE = /\bcaldo de (carne|galinha)\b/;

/**
 * Alimento fora da TACO oficial (texto livre na dieta, ex.: "legumes variados", ou cadastrado depois): secao
 * pelo nome. Ordem importa: "salada de frutas" e fruta, "pao de queijo" e base, "clara de ovo" e proteina.
 */
const NAME_RULES: [RegExp, ShoppingCategory][] = [
  [/\b(fruta|frutas|banana|maca|mamao|morango|laranja|abacaxi|melancia|melao|uva|manga|pera|kiwi|acai|tangerina|mexerica|goiaba|ameixa)\b/, 'frutas'],
  [/\b(legume|legumes|salada|verdura|verduras|folhas?|alface|tomate|brocolis|cenoura|abobrinha|pepino|couve|espinafre|chuchu|vagem|repolho|beterraba|berinjela|abobora|rucula|agriao)\b/, 'legumes'],
  [/\b(arroz|feijao|lentilha|grao de bico|pao|paes|aveia|tapioca|batata|mandioca|aipim|macarrao|massa|cuscuz|granola|cereal|bolacha|torrada|wrap|tortilha|milho|inhame|biscoito de arroz|bisnaguinha|quinoa)\b/, 'bases'],
  [/\b(frango|carne|patinho|alcatra|peixe|tilapia|atum|sardinha|salmao|ovo|ovos|clara|whey|peru|presunto|camarao|bife|porco|lombo|tofu|file|acem|musculo|hamburguer)\b/, 'proteinas'],
  [/\b(leite|iogurte|queijo|requeijao|kefir|coalhada|cream cheese|yopro|ricota|mussarela|cottage)\b/, 'laticinios'],
  [/\b(azeite|oleo|manteiga|castanha|castanhas|amendoim|chia|linhaca|mel|geleia|semente|sementes|nozes|psyllium|tempero)\b/, 'complementos'],
];

/** Sem acento e minusculo, para as regras por nome (\b do JS so entende ASCII). */
function plain(name: string): string {
  return tacoKey(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function categoryByName(foodName: string): ShoppingCategory {
  const name = plain(foodName);
  return NAME_RULES.find(([re]) => re.test(name))?.[1] ?? 'outros';
}

export function categoryFor(tacoId: number | null | undefined, foodName: string): ShoppingCategory {
  const name = tacoKey(foodName);
  if (/^por[cç][aã]o de fruta/.test(name)) return 'frutas';
  if (tacoId != null && CUSTOM_CATEGORY[tacoId]) return CUSTOM_CATEGORY[tacoId];
  if (tacoId == null || tacoId > 597) return categoryByName(foodName);
  if (TUBER_RE.test(name)) return 'bases';
  if (PEANUT_RE.test(name)) return 'complementos';
  if (TOFU_RE.test(name)) return 'proteinas';
  if (BROTH_RE.test(name)) return 'complementos';
  const range = TACO_RANGES.find((r) => tacoId >= r.from && tacoId <= r.to);
  // Pratos prontos da TACO (525-556) misturam de tudo: "Salada, de legumes, cozida no vapor" e legume.
  if (tacoId >= PREPARED_FROM && tacoId <= PREPARED_TO) return categoryByName(foodName);
  const category = range?.category ?? 'outros';
  if (category === 'bases' && SNACK_RE.test(name)) return 'outros';
  return category;
}

// ---------------------------------------------------------------------------------------------
// Peso cru
// ---------------------------------------------------------------------------------------------

/**
 * So converte o que muda de peso de verdade ao cozinhar:
 *  - graos e leguminosas incham (arroz 0,36; feijao 0,23): fator abaixo de 0,5;
 *  - carnes e peixes perdem agua (frango 1,34): fator acima de 1,15, so na secao de proteinas.
 * Legume cozido pesa quase o mesmo que cru: a diferenca de kcal na TACO ali e ruido (abobora dava 1,23,
 * beterraba 0,65). Peixe com fator acima de 1,7 (abadejo 2,2) tambem e ruido: fica no teto.
 */
const GRAIN_MAX_FACTOR = 0.5;
const PROTEIN_MIN_FACTOR = 1.15;
const PROTEIN_MAX_FACTOR = 1.7;

/**
 * Fatores dos alimentos do Michael, tirados dos pares cozido/cru da propria TACO (kcal pronto / kcal cru):
 *  - frango grelhado / peito de frango: "Frango, peito, sem pele" grelhado 159 / cru 119
 *  - carne cozida/grelhada (varios cortes): media de patinho, alcatra, contra-file e coxao mole
 *  - patinho moido pronto: "Carne, bovina, acem, moido" cozido 212 / cru 137
 *  - tilapia/peixe branco: "Merluza, file" assado 122 / cru 89
 *  - lombo: "Porco, lombo" assado 210 / cru 176
 *  - macarrao pronto (125 kcal) / "Macarrao, trigo, cru" 371
 */
const CUSTOM_RAW_FACTOR: Record<number, number> = {
  609: 159 / 119,
  612: 159 / 119,
  613: 1.42,
  658: 1.42,
  662: 212 / 137,
  657: 122 / 89,
  659: 210 / 176,
  651: 125 / 371,
};

// Preparos que mudam o peso so por agua. Frito/refogado ficam de fora: o oleo distorce a conta pelas calorias.
const COOKED_WORDS: [RegExp, string[]][] = [
  [/\bcozid([oa])\b/, ['cru', 'crua']],
  [/\bgrelhad([oa])\b/, ['cru', 'crua']],
  [/\bassad([oa])\b/, ['cru', 'crua']],
];

function usableFactor(f: number, category: ShoppingCategory): number | null {
  if (!Number.isFinite(f) || f <= 0) return null;
  if (f < GRAIN_MAX_FACTOR) return f;
  if (f > PROTEIN_MIN_FACTOR && category === 'proteinas') return Math.min(f, PROTEIN_MAX_FACTOR);
  return null;
}

/**
 * Quanto do peso pronto vira peso cru: cru = pronto x fator. null = comprar o peso como esta na dieta.
 */
export function rawFactor(foodName: string, taco: TacoIndex): number | null {
  const key = tacoKey(foodName);
  const cooked = taco.get(key);
  if (!cooked) return null;
  const category = categoryFor(cooked.id, foodName);
  if (CUSTOM_RAW_FACTOR[cooked.id] != null) return usableFactor(CUSTOM_RAW_FACTOR[cooked.id], category);
  if (cooked.kcal <= 0) return null;
  if (/\b(frit[oa]|refogad[oa])\b/.test(key)) return null;

  for (const [re, rawWords] of COOKED_WORDS) {
    if (!re.test(key)) continue;
    for (const raw of rawWords) {
      const pair = taco.get(key.replace(re, raw));
      if (pair && pair.kcal > 0) return usableFactor(cooked.kcal / pair.kcal, category);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Soma
// ---------------------------------------------------------------------------------------------

/** Dias por semana de cada opcao da refeicao (indice 0 = Opcao 1). Sem escolha: 7 dias na Opcao 1. */
export type OptionDays = Record<string, number[]>;

export function defaultOptionDays(optionCount: number): number[] {
  return Array.from({ length: optionCount }, (_, i) => (i === 0 ? DAYS_PER_WEEK : 0));
}

/** Garante soma 7 e tamanho certo (dieta mudou de numero de opcoes, dado velho no aparelho). */
export function normalizeOptionDays(days: number[] | undefined, optionCount: number): number[] {
  if (!days || days.length !== optionCount) return defaultOptionDays(optionCount);
  const clean = days.map((d) => Math.max(0, Math.min(DAYS_PER_WEEK, Math.round(d) || 0)));
  const sum = clean.reduce((a, b) => a + b, 0);
  return sum === DAYS_PER_WEEK ? clean : defaultOptionDays(optionCount);
}

/**
 * Muda os dias de uma opcao mantendo a soma 7: a diferenca sai (ou volta) da Opcao 1; mexendo na
 * Opcao 1, sai da ultima opcao que ainda tem dias.
 */
export function setOptionDays(current: number[], index: number, value: number): number[] {
  const next = [...current];
  const target = Math.max(0, Math.min(DAYS_PER_WEEK, value));
  let delta = target - next[index];
  next[index] = target;
  const others = next.map((_, i) => i).filter((i) => i !== 0);
  // Opcao 1 subindo: tira das ultimas opcoes primeiro. Descendo: o dia vai para a Opcao 2.
  const donors = index === 0
    ? (delta > 0 ? [...others].reverse() : others)
    : [0, ...next.map((_, i) => i).filter((i) => i !== 0 && i !== index).reverse()];
  for (const i of donors) {
    if (delta === 0) break;
    const take = delta > 0 ? Math.min(delta, next[i]) : delta;
    next[i] -= take;
    delta -= take;
  }
  if (delta !== 0) next[index] -= delta; // nao havia de onde tirar
  return next;
}

const GENERIC_RE = /^por[cç][aã]o de /;

interface Acc {
  key: string;
  generic: boolean;
  grams: number;
  ml: number;
  units: number;
  slices: number;
  portions: number;
}

/** Peso de 1 unidade/fatia do alimento (food_metadata), para mostrar "14 unidades" em vez de "700 g". */
export type UnitWeights = Map<string, { unit: 'unidade' | 'fatia'; grams: number }>;

export function buildShoppingList(params: {
  meals: ShoppingMealInput[];
  optionDays: OptionDays;
  periodDays: number;
  taco: TacoIndex;
  unitWeights?: UnitWeights;
}): ShoppingItem[] {
  const { meals, optionDays, periodDays, taco, unitWeights } = params;
  const acc = new Map<string, Acc>();

  const add = (food: ShoppingFoodInput, times: number) => {
    if (!food.food_name || times <= 0) return;
    const key = food.food_name;
    let a = acc.get(key);
    if (!a) {
      a = { key, generic: GENERIC_RE.test(tacoKey(key)), grams: 0, ml: 0, units: 0, slices: 0, portions: 0 };
      acc.set(key, a);
    }
    const qty = parseQty(food.quantity);
    const units = food.quantity_units && food.quantity_units > 0 ? food.quantity_units : null;
    if (a.generic) {
      a.portions += (units ?? 1) * times;
      return;
    }
    if (food.unit_type === 'ml') {
      a.ml += qty * times;
      return;
    }
    if (food.unit_type === 'unidade' && units) a.units += units * times;
    else if (food.unit_type === 'fatia' && units) a.slices += units * times;
    a.grams += qty * times;
  };

  for (const meal of meals) {
    const optionCount = 1 + meal.options.length;
    const days = normalizeOptionDays(optionDays[meal.id], optionCount);
    const perDay = periodDays / DAYS_PER_WEEK;
    meal.foods.forEach((f) => add(f, days[0] * perDay));
    meal.options.forEach((items, i) => items.forEach((f) => add(f, days[i + 1] * perDay)));
  }

  const items: ShoppingItem[] = [];
  for (const a of acc.values()) {
    const id = taco.get(tacoKey(a.key))?.id ?? null;
    const category = categoryFor(id, a.key);
    let amount: ShoppingAmount;
    if (a.generic) amount = { kind: 'portions', count: Math.ceil(a.portions - 1e-9) };
    else if (a.ml > 0 && a.grams === 0) amount = { kind: 'ml', ml: a.ml };
    else if (a.units > 0) amount = { kind: 'count', unit: 'unidade', count: Math.ceil(a.units - 1e-9), grams: a.grams };
    else if (a.slices > 0) amount = { kind: 'count', unit: 'fatia', count: Math.ceil(a.slices - 1e-9), grams: a.grams };
    else if (!rawFactor(a.key, taco) && unitWeights?.get(a.key)?.grams) {
      // Ovo, pao frances: a dieta guardou em gramas, mas no mercado se compra por unidade.
      const w = unitWeights.get(a.key)!;
      amount = { kind: 'count', unit: w.unit, count: Math.ceil(a.grams / w.grams - 1e-9), grams: a.grams };
    } else {
      const factor = rawFactor(a.key, taco);
      amount = factor
        ? { kind: 'grams', grams: a.grams * factor, cookedGrams: a.grams }
        : { kind: 'grams', grams: a.grams, cookedGrams: null };
    }
    if (amount.kind === 'grams' && amount.grams <= 0) continue;
    if (amount.kind === 'ml' && amount.ml <= 0) continue;
    if ((amount.kind === 'count' || amount.kind === 'portions') && amount.count <= 0) continue;
    items.push({ key: a.key, category, amount, generic: a.generic });
  }
  return items;
}

// ---------------------------------------------------------------------------------------------
// Formatacao (numeros; o texto em volta vem do i18n)
// ---------------------------------------------------------------------------------------------

/** Peso para comprar: arredonda PARA CIMA (falta no mercado e pior que sobra). */
export function formatMass(grams: number, locale: string): string {
  if (grams >= 1000) {
    const kg = Math.ceil(grams / 100 - 1e-9) / 10;
    return `${kg.toLocaleString(locale, { maximumFractionDigits: 1 })} kg`;
  }
  return `${Math.max(10, Math.ceil(grams / 10 - 1e-9) * 10)} g`;
}

export function formatVolume(ml: number, locale: string): string {
  if (ml >= 1000) {
    const l = Math.ceil(ml / 100 - 1e-9) / 10;
    return `${l.toLocaleString(locale, { maximumFractionDigits: 1 })} L`;
  }
  return `${Math.max(10, Math.ceil(ml / 10 - 1e-9) * 10)} ml`;
}
