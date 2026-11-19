import { useEffect, useMemo, useState } from 'react';
import { Apple, Beef, Carrot, Check, Droplet, Info, Milk, Minus, Package, Plus, RotateCcw, ShoppingCart, Wheat, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useShoppingDiet, type ShoppingMeal } from '../../hooks/useShoppingDiet';
import { useI18n, type TKey } from '../../i18n';
import { PageContainer, Header, BottomNav } from '../../components/layout';
import { ProgressBar } from '../../components/ui';
import { formatFoodName } from '../../utils/formatters';
import { getLocalizedUnitLabel } from '../../utils/foodUnits';
import {
  DAYS_PER_WEEK,
  PERIOD_OPTIONS,
  SHOPPING_CATEGORIES,
  buildShoppingList,
  formatMass,
  formatVolume,
  normalizeOptionDays,
  setOptionDays,
  type OptionDays,
  type PeriodDays,
  type ShoppingCategory,
  type ShoppingItem,
} from '../../utils/shoppingList';
import styles from './ShoppingList.module.css';

const CATEGORY_ICON: Record<ShoppingCategory, LucideIcon> = {
  proteinas: Beef,
  bases: Wheat,
  frutas: Apple,
  legumes: Carrot,
  laticinios: Milk,
  complementos: Droplet,
  outros: Package,
};

/** Escolhas do aluno, por aluno e por dieta, neste aparelho. */
interface SavedState {
  period: PeriodDays;
  optionDays: OptionDays;
  checked: string[];
}
const EMPTY_STATE: SavedState = { period: 7, optionDays: {}, checked: [] };
const storageKey = (userId: string, dietId: string) => `michael-shopping:${userId}:${dietId}`;

function readState(key: string | null): SavedState {
  if (!key) return EMPTY_STATE;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<SavedState>;
    return {
      period: PERIOD_OPTIONS.includes(parsed.period as PeriodDays) ? (parsed.period as PeriodDays) : 7,
      optionDays: parsed.optionDays && typeof parsed.optionDays === 'object' ? parsed.optionDays : {},
      checked: Array.isArray(parsed.checked) ? parsed.checked.filter((x) => typeof x === 'string') : [],
    };
  } catch {
    return EMPTY_STATE;
  }
}

export function ShoppingList() {
  const { profile } = useAuth();
  const { t, tc, locale } = useI18n();
  const { loading, error, diets, dietId, changeDiet, meals, taco, simpleNames, unitWeights } = useShoppingDiet(profile?.id);

  const key = profile?.id && dietId ? storageKey(profile.id, dietId) : null;
  const [saved, setSaved] = useState<{ key: string | null; state: SavedState }>({ key: null, state: EMPTY_STATE });
  // Trocou de dieta (ou terminou de carregar): le o que estava salvo para ela.
  const state = saved.key === key ? saved.state : readState(key);

  const update = (patch: Partial<SavedState>) => {
    const next = { ...state, ...patch };
    setSaved({ key, state: next });
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* sem storage: vale so nesta visita */ }
  };

  const items = useMemo(
    () => buildShoppingList({ meals, optionDays: state.optionDays, periodDays: state.period, taco, unitWeights }),
    [meals, state.optionDays, state.period, taco, unitWeights],
  );

  const displayName = (item: ShoppingItem) => tc('food', simpleNames.get(item.key) || formatFoodName(item.key));

  const groups = useMemo(() => {
    const byCat = new Map<ShoppingCategory, ShoppingItem[]>();
    for (const item of items) {
      const list = byCat.get(item.category) ?? [];
      list.push(item);
      byCat.set(item.category, list);
    }
    return SHOPPING_CATEGORIES
      .filter((c) => byCat.has(c))
      .map((c) => ({
        category: c,
        items: byCat.get(c)!.sort((a, b) => displayName(a).localeCompare(displayName(b), locale)),
      }));
    // displayName depende so de simpleNames/tc/locale
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, simpleNames, locale, tc]);

  const checked = useMemo(() => new Set(state.checked), [state.checked]);
  const doneCount = items.filter((i) => checked.has(i.key)).length;

  // Alimento que saiu da dieta nao fica marcado para sempre no aparelho.
  useEffect(() => {
    if (loading || items.length === 0) return;
    const valid = state.checked.filter((k) => items.some((i) => i.key === k));
    if (valid.length !== state.checked.length) update({ checked: valid });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, items]);

  const toggle = (itemKey: string) => {
    update({ checked: checked.has(itemKey) ? state.checked.filter((k) => k !== itemKey) : [...state.checked, itemKey] });
  };

  const mealsWithOptions = meals.filter((m) => m.options.length > 0);
  const daysFor = (meal: ShoppingMeal) => normalizeOptionDays(state.optionDays[meal.id], meal.options.length + 1);
  const changeDays = (meal: ShoppingMeal, index: number, value: number) => {
    update({ optionDays: { ...state.optionDays, [meal.id]: setOptionDays(daysFor(meal), index, value) } });
  };

  const optionLabel = (meal: ShoppingMeal, index: number) =>
    index === 0
      ? t('diet.option', { n: 1 })
      : tc('meal', meal.optionNames[index]) || t('diet.option', { n: index + 1 });

  function amountText(item: ShoppingItem): { main: string; tag?: string; sub?: string } {
    const a = item.amount;
    switch (a.kind) {
      case 'grams':
        return a.cookedGrams
          ? { main: formatMass(a.grams, locale), tag: t('shopping.raw'), sub: t('shopping.cookedApprox', { amount: formatMass(a.cookedGrams, locale) }) }
          : { main: formatMass(a.grams, locale) };
      case 'ml':
        return { main: formatVolume(a.ml, locale) };
      case 'count':
        return {
          main: `${a.count} ${getLocalizedUnitLabel(t, a.unit, a.count)}`,
          sub: a.grams > 0 ? t('shopping.approxWeight', { amount: formatMass(a.grams, locale) }) : undefined,
        };
      case 'portions':
        return { main: `${a.count} ${getLocalizedUnitLabel(t, 'porcao', a.count)}` };
    }
  }

  const currentDiet = diets.find((d) => d.id === dietId);

  return (
    <PageContainer>
      <Header
        title={t('shopping.title')}
        subtitle={currentDiet ? tc('diet_plan', currentDiet.name) : undefined}
        showBack
      />

      <main className={styles.content}>
        {loading ? (
          <div className={styles.skeleton} aria-busy="true">
            <span /><span /><span />
          </div>
        ) : error ? (
          <div className={styles.emptyState}>
            <p>{t('shopping.error')}</p>
            <button type="button" className={styles.linkButton} onClick={() => window.location.reload()}>
              {t('shopping.retry')}
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className={styles.emptyState}>
            <ShoppingCart size={32} aria-hidden />
            <p>{t('shopping.empty')}</p>
          </div>
        ) : (
          <>
            {diets.length > 1 && (
              <div className={styles.dietSelector}>
                <label className={styles.dietSelectorLabel} htmlFor="shopping-diet">{t('diet.activeDiet')}</label>
                <select
                  id="shopping-diet"
                  className={styles.dietSelectorSelect}
                  value={dietId ?? ''}
                  onChange={(e) => changeDiet(e.target.value)}
                >
                  {diets.map((d) => (
                    <option key={d.id} value={d.id}>{tc('diet_plan', d.name)}</option>
                  ))}
                </select>
              </div>
            )}

            <section className={styles.panel} aria-labelledby="shopping-period">
              <h2 id="shopping-period" className={styles.panelLabel}>{t('shopping.period')}</h2>
              <div className={styles.periods} role="radiogroup" aria-labelledby="shopping-period">
                {PERIOD_OPTIONS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={state.period === p}
                    className={`${styles.period} ${state.period === p ? styles.periodActive : ''}`}
                    onClick={() => update({ period: p })}
                  >
                    {t('shopping.days', { n: p })}
                  </button>
                ))}
              </div>
            </section>

            {mealsWithOptions.length > 0 && (
              <section className={styles.panel} aria-labelledby="shopping-options">
                <h2 id="shopping-options" className={styles.panelTitle}>{t('shopping.optionsTitle')}</h2>
                <p className={styles.panelHint}>{t('shopping.optionsHint')}</p>
                {mealsWithOptions.map((meal) => {
                  const days = daysFor(meal);
                  return (
                    <div key={meal.id} className={styles.optionMeal}>
                      <h3 className={styles.optionMealName}>{tc('meal', meal.name)}</h3>
                      {days.map((d, i) => (
                        <div key={i} className={styles.optionRow}>
                          <span className={styles.optionName}>{optionLabel(meal, i)}</span>
                          <div className={styles.stepper}>
                            <button
                              type="button"
                              className={styles.stepButton}
                              aria-label={`${t('shopping.decrease')}: ${optionLabel(meal, i)}`}
                              disabled={d === 0}
                              onClick={() => changeDays(meal, i, d - 1)}
                            >
                              <Minus size={16} aria-hidden />
                            </button>
                            <span className={styles.stepValue} aria-live="polite">
                              <strong>{d}</strong> {t(d === 1 ? 'shopping.dayPerWeek' : 'shopping.daysPerWeek')}
                            </span>
                            <button
                              type="button"
                              className={styles.stepButton}
                              aria-label={`${t('shopping.increase')}: ${optionLabel(meal, i)}`}
                              disabled={d === DAYS_PER_WEEK}
                              onClick={() => changeDays(meal, i, d + 1)}
                            >
                              <Plus size={16} aria-hidden />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </section>
            )}

            <div className={styles.progress}>
              <div className={styles.progressText}>
                <ShoppingCart size={18} aria-hidden />
                <span>
                  {doneCount === items.length
                    ? t('shopping.allDone')
                    : t('shopping.progress', { done: doneCount, total: items.length })}
                </span>
              </div>
              <ProgressBar value={doneCount} max={items.length} size="sm" variant={doneCount === items.length ? 'success' : 'accent'} />
            </div>

            {groups.map(({ category, items: list }) => {
              const Icon = CATEGORY_ICON[category];
              const done = list.filter((i) => checked.has(i.key)).length;
              return (
                <section key={category} className={styles.category} aria-labelledby={`cat-${category}`}>
                  <header className={styles.categoryHeader}>
                    <span className={styles.categoryIcon}><Icon size={20} aria-hidden /></span>
                    <h2 id={`cat-${category}`} className={styles.categoryTitle}>
                      {t(`shopping.cat.${category}` as TKey)}
                    </h2>
                    <span className={styles.categoryCount}>{done}/{list.length}</span>
                  </header>
                  <ul className={styles.itemList}>
                    {list.map((item) => {
                      const isChecked = checked.has(item.key);
                      const amount = amountText(item);
                      return (
                        <li key={item.key}>
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={isChecked}
                            className={`${styles.item} ${isChecked ? styles.itemChecked : ''}`}
                            onClick={() => toggle(item.key)}
                          >
                            <span className={styles.check} aria-hidden>
                              {isChecked && <Check size={14} strokeWidth={3} />}
                            </span>
                            <span className={styles.itemText}>
                              <span className={styles.itemName}>{displayName(item)}</span>
                              {item.generic && <span className={styles.itemSub}>{t('shopping.yourChoice')}</span>}
                              {amount.sub && <span className={styles.itemSub}>{amount.sub}</span>}
                            </span>
                            <span className={styles.amount}>
                              {amount.main}
                              {amount.tag && <span className={styles.amountTag}>{amount.tag}</span>}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}

            {doneCount > 0 && (
              <button type="button" className={styles.resetButton} onClick={() => update({ checked: [] })}>
                <RotateCcw size={16} aria-hidden /> {t('shopping.newList')}
              </button>
            )}

            <p className={styles.note}>
              <Info size={16} aria-hidden />
              <span>{t('shopping.note')}</span>
            </p>
          </>
        )}
      </main>

      <BottomNav />
    </PageContainer>
  );
}
