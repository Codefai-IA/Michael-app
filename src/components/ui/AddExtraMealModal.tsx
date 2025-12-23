import { useState } from 'react';
import { Plus, X, Search, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { parseBrazilianNumber } from './FoodSelect';
import { formatFoodName } from '../../utils/formatters';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import type { TabelaTaco } from '../../types/database';
import styles from './AddExtraMealModal.module.css';

interface ExtraFood {
  id: string;
  name: string;
  quantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface ExtraMeal {
  id: string;
  meal_name: string;
  foods: ExtraFood[];
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fats: number;
}

interface AddExtraMealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (meal: ExtraMeal) => void;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/,/g, ' ')
    .trim();
}

export function AddExtraMealModal({ isOpen, onClose, onAdd }: AddExtraMealModalProps) {
  const [mealName, setMealName] = useState('');
  const [foods, setFoods] = useState<ExtraFood[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<TabelaTaco[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState<TabelaTaco | null>(null);
  const [quantity, setQuantity] = useState('100');
  const searchFoods = async (term: string) => {
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    const normalizedTerm = normalizeText(term);
    const searchWords = normalizedTerm.split(/\s+/).filter(w => w.length > 0);

    try {
      const { data, error } = await supabase
        .from('tabela_taco')
        .select('*')
        .order('alimento', { ascending: true })
        .limit(500);

      if (error) {
        console.error('Erro ao buscar alimentos:', error);
        setLoading(false);
        return;
      }

      if (data) {
        const filtered = data.filter(food => {
          const normalizedName = normalizeText(food.alimento);
          return searchWords.every(word => normalizedName.includes(word));
        });

        filtered.sort((a, b) => {
          const aName = normalizeText(a.alimento);
          const bName = normalizeText(b.alimento);
          const firstWord = searchWords[0] || '';
          const aStartsWith = aName.startsWith(firstWord);
          const bStartsWith = bName.startsWith(firstWord);
          if (aStartsWith && !bStartsWith) return -1;
          if (!aStartsWith && bStartsWith) return 1;
          return aName.localeCompare(bName);
        });

        setSearchResults(filtered.slice(0, 20));
      }
    } catch (err) {
      console.error('Erro ao buscar alimentos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    setSelectedFood(null);
    searchFoods(term);
  };

  const handleSelectFood = (food: TabelaTaco) => {
    setSelectedFood(food);
    setSearchTerm(food.alimento);
    setSearchResults([]);
  };

  const addFoodToMeal = () => {
    if (!selectedFood) return;

    const qty = parseFloat(quantity) || 100;
    const multiplier = qty / 100;

    const newFood: ExtraFood = {
      id: crypto.randomUUID(),
      name: formatFoodName(selectedFood.alimento),
      quantity: qty,
      calories: Math.round(parseBrazilianNumber(selectedFood.caloria) * multiplier),
      protein: Math.round(parseBrazilianNumber(selectedFood.proteina) * multiplier * 10) / 10,
      carbs: Math.round(parseBrazilianNumber(selectedFood.carboidrato) * multiplier * 10) / 10,
      fats: Math.round(parseBrazilianNumber(selectedFood.gordura) * multiplier * 10) / 10,
    };

    setFoods([...foods, newFood]);
    setSelectedFood(null);
    setSearchTerm('');
    setQuantity('100');
  };

  const removeFood = (id: string) => {
    setFoods(foods.filter(f => f.id !== id));
  };

  const updateFoodQuantity = (id: string, newQty: string) => {
    const qty = parseFloat(newQty) || 0;
    setFoods(foods.map(f => {
      if (f.id !== id) return f;
      const originalMultiplier = f.quantity / 100;
      const newMultiplier = qty / 100;
      const ratio = originalMultiplier > 0 ? newMultiplier / originalMultiplier : newMultiplier;
      return {
        ...f,
        quantity: qty,
        calories: Math.round((f.calories / (f.quantity / 100)) * (qty / 100)),
        protein: Math.round(((f.protein / (f.quantity / 100)) * (qty / 100)) * 10) / 10,
        carbs: Math.round(((f.carbs / (f.quantity / 100)) * (qty / 100)) * 10) / 10,
        fats: Math.round(((f.fats / (f.quantity / 100)) * (qty / 100)) * 10) / 10,
      };
    }));
  };

  const mealTotals = foods.reduce(
    (acc, food) => ({
      calories: acc.calories + food.calories,
      protein: acc.protein + food.protein,
      carbs: acc.carbs + food.carbs,
      fats: acc.fats + food.fats,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );

  const handleSave = () => {
    const extraMeal: ExtraMeal = {
      id: crypto.randomUUID(),
      meal_name: mealName || 'Refeicao Extra',
      foods,
      total_calories: mealTotals.calories,
      total_protein: mealTotals.protein,
      total_carbs: mealTotals.carbs,
      total_fats: mealTotals.fats,
    };

    onAdd(extraMeal);
    handleClose();
  };

  const handleClose = () => {
    setMealName('');
    setFoods([]);
    setSearchTerm('');
    setSearchResults([]);
    setSelectedFood(null);
    setQuantity('100');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Adicionar Refeicao Extra">
      <div className={styles.content}>
        <Input
          label="Nome da refeicao"
          placeholder="Ex: Lanche da tarde"
          value={mealName}
          onChange={(e) => setMealName(e.target.value)}
        />

        <div className={styles.searchSection}>
          <label className={styles.label}>Buscar alimento</label>
          <div className={styles.searchWrapper}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Digite para buscar..."
              value={searchTerm}
              onChange={handleInputChange}
              className={styles.searchInput}
              autoComplete="off"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSearchResults([]);
                  setSelectedFood(null);
                }}
                className={styles.clearButton}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {loading && <div className={styles.loadingState}>Buscando...</div>}

          {!loading && searchTerm.length >= 2 && searchResults.length === 0 && !selectedFood && (
            <div className={styles.loadingState}>Nenhum alimento encontrado para "{searchTerm}"</div>
          )}

          {!loading && searchResults.length > 0 && (
            <ul className={styles.searchResults}>
              {searchResults.map((food) => (
                <li
                  key={food.id}
                  className={styles.searchItem}
                  onClick={() => handleSelectFood(food)}
                >
                  <span className={styles.foodName}>{formatFoodName(food.alimento)}</span>
                  <span className={styles.foodCal}>
                    {Math.round(parseBrazilianNumber(food.caloria))} kcal
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selectedFood && (
          <div className={styles.addFoodSection}>
            <div className={styles.selectedFood}>
              <span>{formatFoodName(selectedFood.alimento)}</span>
              <span className={styles.selectedNutrition}>
                {Math.round(parseBrazilianNumber(selectedFood.caloria))} kcal/100g
              </span>
            </div>
            <div className={styles.quantityRow}>
              <Input
                label="Quantidade (g)"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={styles.quantityInput}
              />
              <Button onClick={addFoodToMeal} className={styles.addButton}>
                <Plus size={18} />
                Adicionar
              </Button>
            </div>
          </div>
        )}

        {foods.length > 0 && (
          <div className={styles.addedFoods}>
            <h4 className={styles.sectionTitle}>Alimentos adicionados</h4>
            <ul className={styles.foodList}>
              {foods.map((food) => (
                <li key={food.id} className={styles.foodItem}>
                  <div className={styles.foodInfo}>
                    <span className={styles.foodItemName}>{food.name}</span>
                    <span className={styles.foodItemMacros}>
                      {food.calories} kcal | P: {food.protein}g | C: {food.carbs}g | G: {food.fats}g
                    </span>
                  </div>
                  <div className={styles.foodActions}>
                    <input
                      type="number"
                      value={food.quantity}
                      onChange={(e) => updateFoodQuantity(food.id, e.target.value)}
                      className={styles.foodQuantityInput}
                    />
                    <span className={styles.gramLabel}>g</span>
                    <button
                      onClick={() => removeFood(food.id)}
                      className={styles.removeButton}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className={styles.totals}>
              <h4>Total da refeicao:</h4>
              <div className={styles.totalsValues}>
                <span className={styles.totalCalories}>{mealTotals.calories} kcal</span>
                <span>P: {mealTotals.protein.toFixed(1)}g</span>
                <span>C: {mealTotals.carbs.toFixed(1)}g</span>
                <span>G: {mealTotals.fats.toFixed(1)}g</span>
              </div>
            </div>
          </div>
        )}

        <div className={styles.actions}>
          <Button variant="ghost" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={foods.length === 0}>
            Salvar Refeicao
          </Button>
        </div>
      </div>
    </Modal>
  );
}
