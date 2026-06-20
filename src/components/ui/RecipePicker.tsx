import { useState, useEffect, useMemo } from 'react';
import { X, Search, ChevronLeft, Plus, Loader2, UtensilsCrossed } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getYoutubeThumbnail, getYoutubeEmbedUrl } from '../../lib/youtube';
import type { Recipe } from '../../types/database';
import styles from './RecipePicker.module.css';

interface RecipePickerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Chamado ao confirmar uma receita. O pai a adiciona como refeição extra (soma macros). */
  onAdd: (recipe: Recipe) => void | Promise<void>;
}

// Remove acentos (faixa de marcas combinantes U+0300–U+036F) sem usar
// caracteres combinantes literais no código-fonte.
const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');
function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(DIACRITICS, '');
}

export function RecipePicker({ isOpen, onClose, onAdd }: RecipePickerProps) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('Todas');
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoading(true);
    supabase
      .from('recipes')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) console.error('Erro ao buscar receitas:', error);
        setRecipes((data as Recipe[]) ?? []);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  // Reset ao fechar
  useEffect(() => {
    if (!isOpen) {
      setSelected(null);
      setSearch('');
      setCategory('Todas');
    }
  }, [isOpen]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    recipes.forEach((r) => r.category && set.add(r.category));
    return ['Todas', ...Array.from(set).sort()];
  }, [recipes]);

  const filtered = useMemo(() => {
    const term = normalize(search.trim());
    return recipes.filter((r) => {
      if (category !== 'Todas' && r.category !== category) return false;
      if (term && !normalize(r.title).includes(term)) return false;
      return true;
    });
  }, [recipes, search, category]);

  async function handleConfirm() {
    if (!selected) return;
    setAdding(true);
    try {
      await onAdd(selected);
      onClose();
    } finally {
      setAdding(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        {/* Header */}
        <div className={styles.header}>
          {selected ? (
            <button className={styles.iconBtn} onClick={() => setSelected(null)} aria-label="Voltar">
              <ChevronLeft size={22} />
            </button>
          ) : (
            <span className={styles.headerSpacer} />
          )}
          <h2 className={styles.headerTitle}>{selected ? 'Receita' : 'Receitas'}</h2>
          <button className={styles.iconBtn} onClick={onClose} aria-label="Fechar">
            <X size={22} />
          </button>
        </div>

        {selected ? (
          /* -------- Detalhe: vídeo vertical + macros -------- */
          <div className={styles.detail}>
            <div className={styles.videoFrame}>
              <iframe
                src={getYoutubeEmbedUrl(selected.youtube_url) ?? ''}
                title={selected.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className={styles.videoIframe}
              />
            </div>

            <h3 className={styles.detailTitle}>{selected.title}</h3>
            {selected.servings && <p className={styles.detailServings}>{selected.servings}</p>}

            <div className={styles.macrosGrid}>
              <div className={styles.macroBox}>
                <span className={styles.macroValue}>{Math.round(selected.calories)}</span>
                <span className={styles.macroName}>kcal</span>
              </div>
              <div className={styles.macroBox}>
                <span className={styles.macroValue}>{selected.protein}g</span>
                <span className={styles.macroName}>Proteína</span>
              </div>
              <div className={styles.macroBox}>
                <span className={styles.macroValue}>{selected.carbs}g</span>
                <span className={styles.macroName}>Carbo</span>
              </div>
              <div className={styles.macroBox}>
                <span className={styles.macroValue}>{selected.fat}g</span>
                <span className={styles.macroName}>Gordura</span>
              </div>
            </div>

            <button className={styles.addBtn} onClick={handleConfirm} disabled={adding}>
              {adding ? <Loader2 size={18} className={styles.spin} /> : <Plus size={18} />}
              {adding ? 'Adicionando…' : 'Adicionar ao meu dia'}
            </button>
          </div>
        ) : (
          /* -------- Lista: busca + categorias + grid -------- */
          <>
            <div className={styles.searchWrap}>
              <Search size={18} className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                placeholder="Buscar receita..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className={styles.chips}>
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`${styles.chip} ${category === cat ? styles.chipActive : ''}`}
                  onClick={() => setCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className={styles.scrollArea}>
              {loading ? (
                <div className={styles.stateMsg}>
                  <Loader2 size={28} className={styles.spin} />
                  <p>Carregando receitas...</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className={styles.stateMsg}>
                  <UtensilsCrossed size={32} />
                  <p>Nenhuma receita encontrada</p>
                </div>
              ) : (
                <div className={styles.grid}>
                  {filtered.map((recipe) => {
                    const thumb = getYoutubeThumbnail(recipe.youtube_url, 'hq');
                    return (
                      <button key={recipe.id} className={styles.card} onClick={() => setSelected(recipe)}>
                        <div className={styles.cardThumb}>
                          {thumb ? (
                            <img src={thumb} alt="" loading="lazy" />
                          ) : (
                            <UtensilsCrossed size={28} />
                          )}
                        </div>
                        <div className={styles.cardBody}>
                          <span className={styles.cardTitle}>{recipe.title}</span>
                          <span className={styles.cardMacros}>
                            {Math.round(recipe.calories)} kcal · P {recipe.protein} · C {recipe.carbs} · G {recipe.fat}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
