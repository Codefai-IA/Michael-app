import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Check, Pencil, X, UtensilsCrossed } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Card, Button } from '../ui';
import { getYoutubeId, getYoutubeThumbnail } from '../../lib/youtube';
import type { Recipe } from '../../types/database';
import styles from './RecipesManager.module.css';

// Categorias sugeridas (campo é livre, mas estas aparecem como atalho)
const SUGGESTED_CATEGORIES = ['Café da manhã', 'Almoço', 'Jantar', 'Lanches', 'Doces fit', 'Pós-treino', 'Shakes'];

interface RecipeForm {
  title: string;
  youtube_url: string;
  category: string;
  servings: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
}

const EMPTY_FORM: RecipeForm = {
  title: '',
  youtube_url: '',
  category: '',
  servings: '',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
};

export function RecipesManager() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RecipeForm>(EMPTY_FORM);

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error('Erro ao buscar receitas:', error);
    setRecipes((data as Recipe[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  function updateField(field: keyof RecipeForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function startEdit(recipe: Recipe) {
    setEditingId(recipe.id);
    setForm({
      title: recipe.title,
      youtube_url: recipe.youtube_url,
      category: recipe.category ?? '',
      servings: recipe.servings ?? '',
      calories: String(recipe.calories ?? ''),
      protein: String(recipe.protein ?? ''),
      carbs: String(recipe.carbs ?? ''),
      fat: String(recipe.fat ?? ''),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSave() {
    if (!form.title.trim()) {
      alert('Informe o título da receita');
      return;
    }
    if (!getYoutubeId(form.youtube_url)) {
      alert('Cole um link válido do YouTube (vídeo ou Short)');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        youtube_url: form.youtube_url.trim(),
        category: form.category.trim() || null,
        servings: form.servings.trim() || null,
        calories: Number(form.calories) || 0,
        protein: Number(form.protein) || 0,
        carbs: Number(form.carbs) || 0,
        fat: Number(form.fat) || 0,
      };

      if (editingId) {
        const { error } = await supabase.from('recipes').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('recipes').insert(payload);
        if (error) throw error;
      }

      resetForm();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await fetchRecipes();
    } catch (error: any) {
      console.error('Erro ao salvar receita:', error);
      alert('Erro ao salvar: ' + (error?.message ?? 'tente novamente'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta receita?')) return;
    const { error } = await supabase.from('recipes').delete().eq('id', id);
    if (error) {
      alert('Erro ao excluir: ' + error.message);
      return;
    }
    if (editingId === id) resetForm();
    await fetchRecipes();
  }

  return (
    <div className={styles.container}>
      <div className={styles.description}>
        <UtensilsCrossed size={18} className={styles.descIcon} />
        <p>
          Cadastre receitas em <strong>vídeo (YouTube Shorts)</strong> com os macros prontos. Elas
          aparecem para o aluno em <strong>Dieta → Adicionar refeição → Adicionar receita</strong>.
        </p>
      </div>

      {/* Formulário (adicionar / editar) */}
      <Card className={styles.formCard}>
        <h3 className={styles.formTitle}>
          {editingId ? 'Editar receita' : 'Nova receita'}
          {editingId && (
            <button className={styles.cancelEdit} onClick={resetForm} type="button">
              <X size={16} /> cancelar
            </button>
          )}
        </h3>

        <label className={styles.label}>Título</label>
        <input
          className={styles.input}
          value={form.title}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder="Ex: Panqueca de banana fit"
        />

        <label className={styles.label}>URL do YouTube / Shorts</label>
        <input
          className={styles.input}
          value={form.youtube_url}
          onChange={(e) => updateField('youtube_url', e.target.value)}
          placeholder="https://youtube.com/shorts/..."
        />

        <div className={styles.row}>
          <div className={styles.col}>
            <label className={styles.label}>Categoria</label>
            <input
              className={styles.input}
              value={form.category}
              onChange={(e) => updateField('category', e.target.value)}
              placeholder="Ex: Café da manhã"
              list="recipe-categories"
            />
            <datalist id="recipe-categories">
              {SUGGESTED_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className={styles.col}>
            <label className={styles.label}>Porção / rendimento</label>
            <input
              className={styles.input}
              value={form.servings}
              onChange={(e) => updateField('servings', e.target.value)}
              placeholder="Ex: 1 porção"
            />
          </div>
        </div>

        <label className={styles.label}>Macros</label>
        <div className={styles.macrosRow}>
          <div className={styles.macroField}>
            <span className={styles.macroLabel}>kcal</span>
            <input className={styles.input} type="number" inputMode="decimal" value={form.calories} onChange={(e) => updateField('calories', e.target.value)} placeholder="0" />
          </div>
          <div className={styles.macroField}>
            <span className={styles.macroLabel}>Proteína (g)</span>
            <input className={styles.input} type="number" inputMode="decimal" value={form.protein} onChange={(e) => updateField('protein', e.target.value)} placeholder="0" />
          </div>
          <div className={styles.macroField}>
            <span className={styles.macroLabel}>Carbo (g)</span>
            <input className={styles.input} type="number" inputMode="decimal" value={form.carbs} onChange={(e) => updateField('carbs', e.target.value)} placeholder="0" />
          </div>
          <div className={styles.macroField}>
            <span className={styles.macroLabel}>Gordura (g)</span>
            <input className={styles.input} type="number" inputMode="decimal" value={form.fat} onChange={(e) => updateField('fat', e.target.value)} placeholder="0" />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} fullWidth className={saved ? styles.savedBtn : ''}>
          {saving ? 'Salvando...' : saved ? (
            <><Check size={18} /> Salvo!</>
          ) : editingId ? (
            <><Check size={18} /> Salvar alterações</>
          ) : (
            <><Plus size={18} /> Adicionar receita</>
          )}
        </Button>
      </Card>

      {/* Lista */}
      {loading ? (
        <div className={styles.loading}>Carregando receitas...</div>
      ) : recipes.length === 0 ? (
        <Card className={styles.emptyState}>
          <UtensilsCrossed size={32} />
          <p>Nenhuma receita cadastrada</p>
          <span>Adicione a primeira no formulário acima</span>
        </Card>
      ) : (
        <div className={styles.list}>
          {recipes.map((recipe) => {
            const thumb = getYoutubeThumbnail(recipe.youtube_url, 'mq');
            return (
              <div key={recipe.id} className={styles.item}>
                {thumb && <img src={thumb} alt="" className={styles.thumb} loading="lazy" />}
                <div className={styles.itemInfo}>
                  <span className={styles.itemTitle}>{recipe.title}</span>
                  {recipe.category && <span className={styles.itemCategory}>{recipe.category}</span>}
                  <span className={styles.itemMacros}>
                    {Math.round(recipe.calories)} kcal · P {recipe.protein}g · C {recipe.carbs}g · G {recipe.fat}g
                  </span>
                </div>
                <div className={styles.itemActions}>
                  <button className={styles.editBtn} onClick={() => startEdit(recipe)} aria-label="Editar">
                    <Pencil size={16} />
                  </button>
                  <button className={styles.removeBtn} onClick={() => handleDelete(recipe.id)} aria-label="Excluir">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
