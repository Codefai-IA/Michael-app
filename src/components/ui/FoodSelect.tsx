import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { Search, X, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { TabelaTaco } from '../../types/database';
import styles from './FoodSelect.module.css';

// Helper para converter números no formato brasileiro (vírgula como decimal)
export function parseBrazilianNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;

  // Substitui vírgula por ponto e faz o parse
  const normalized = value.toString().replace(',', '.');
  const parsed = parseFloat(normalized);

  return isNaN(parsed) ? 0 : parsed;
}

// Normaliza texto removendo acentos e convertendo para minúsculas
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/,/g, ' ') // Substitui vírgulas por espaços
    .trim();
}

interface FoodSelectProps {
  value: string;
  onChange: (foodName: string) => void;
  onFoodSelect?: (food: TabelaTaco) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function FoodSelect({
  value,
  onChange,
  onFoodSelect,
  placeholder = 'Buscar alimento...',
  disabled = false,
}: FoodSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value);
  const [foods, setFoods] = useState<TabelaTaco[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState<TabelaTaco | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    setSearchTerm(value);
    if (!value) {
      setSelectedFood(null);
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const searchFoods = async () => {
      if (searchTerm.length < 2) {
        setFoods([]);
        return;
      }

      setLoading(true);

      // Normaliza o termo de busca
      const normalizedSearchTerm = normalizeText(searchTerm);
      const searchWords = normalizedSearchTerm.split(/\s+/).filter(w => w.length > 0);

      // Busca mais resultados para filtrar localmente (fuzzy search)
      const { data, error } = await supabase
        .from('tabela_taco')
        .select('*')
        .order('alimento', { ascending: true })
        .limit(500);

      if (error) {
        console.error('Erro ao buscar alimentos:', error);
        setFoods([]);
      } else if (data) {
        // Filtra localmente com busca flexível
        const filteredFoods = data.filter(food => {
          const normalizedFoodName = normalizeText(food.alimento);

          // Verifica se TODAS as palavras da busca estão no nome do alimento
          return searchWords.every(word => normalizedFoodName.includes(word));
        });

        // Ordena por relevância (alimentos que começam com a busca primeiro)
        filteredFoods.sort((a, b) => {
          const aName = normalizeText(a.alimento);
          const bName = normalizeText(b.alimento);
          const firstWord = searchWords[0] || '';

          const aStartsWith = aName.startsWith(firstWord);
          const bStartsWith = bName.startsWith(firstWord);

          if (aStartsWith && !bStartsWith) return -1;
          if (!aStartsWith && bStartsWith) return 1;
          return aName.localeCompare(bName);
        });

        setFoods(filteredFoods.slice(0, 30)); // Limita a 30 resultados
        setHighlightedIndex(0);
      }
      setLoading(false);
    };

    const debounceTimer = setTimeout(searchFoods, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm]);

  useEffect(() => {
    if (listRef.current && foods.length > 0) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, foods.length]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    onChange(newValue);
    setSelectedFood(null);
    setIsOpen(true);
  };

  const handleFoodSelect = (food: TabelaTaco) => {
    setSelectedFood(food);
    setSearchTerm(food.alimento);
    onChange(food.alimento);
    onFoodSelect?.(food);
    setIsOpen(false);
  };

  const handleClear = () => {
    setSelectedFood(null);
    setSearchTerm('');
    onChange('');
    setFoods([]);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || foods.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < foods.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (foods[highlightedIndex]) {
          handleFoodSelect(foods[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  const formatCalories = (cal: string) => {
    const num = parseBrazilianNumber(cal);
    return num === 0 ? cal : `${Math.round(num)} kcal`;
  };

  const formatNutrient = (value: string) => {
    const num = parseBrazilianNumber(value);
    return num.toFixed(1);
  };

  const highlightMatch = (text: string, search: string) => {
    if (!search || search.length < 2) return text;

    const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <span key={index} className={styles.highlight}>
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <div className={`${styles.inputWrapper} ${selectedFood ? styles.hasSelection : ''}`}>
        <Search size={18} className={styles.searchIcon} />
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => searchTerm.length >= 2 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={styles.input}
          autoComplete="off"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={handleClear}
            className={styles.clearButton}
            aria-label="Limpar"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {selectedFood && (
        <div className={styles.selectedInfo}>
          <Check size={14} className={styles.checkIcon} />
          <span className={styles.nutritionInfo}>
            {formatCalories(selectedFood.caloria)} | P: {formatNutrient(selectedFood.proteina)}g | C: {formatNutrient(selectedFood.carboidrato)}g | G: {formatNutrient(selectedFood.gordura)}g
          </span>
        </div>
      )}

      {isOpen && (
        <div className={styles.dropdown}>
          {loading && (
            <div className={styles.loadingState}>Buscando alimentos...</div>
          )}

          {!loading && searchTerm.length >= 2 && foods.length === 0 && (
            <div className={styles.emptyState}>Nenhum alimento encontrado</div>
          )}

          {!loading && searchTerm.length < 2 && (
            <div className={styles.hintState}>Digite pelo menos 2 caracteres para buscar</div>
          )}

          {!loading && foods.length > 0 && (
            <ul className={styles.foodList} ref={listRef}>
              {foods.map((food, index) => (
                <li
                  key={food.id}
                  className={`${styles.foodItem} ${index === highlightedIndex ? styles.highlighted : ''}`}
                  onClick={() => handleFoodSelect(food)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <span className={styles.foodName}>
                    {highlightMatch(food.alimento, searchTerm)}
                  </span>
                  <span className={styles.foodCalories}>
                    {formatCalories(food.caloria)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
