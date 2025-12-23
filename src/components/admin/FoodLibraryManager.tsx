import { useState, useEffect } from 'react';
import { Search, Plus, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Input, Card } from '../ui';
import styles from './FoodLibraryManager.module.css';

interface Food {
  id: number;
  alimento: string;
  caloria: string;
  proteina: string;
  carboidrato: string;
  fibra: string;
  gordura?: string;
  created_at?: string;
}

export function FoodLibraryManager() {
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingFood, setEditingFood] = useState<Food | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    alimento: '',
    caloria: '',
    proteina: '',
    carboidrato: '',
    fibra: '',
    gordura: ''
  });

  useEffect(() => {
    loadFoods();
  }, []);

  const loadFoods = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tabela_taco')
      .select('*')
      .order('alimento', { ascending: true });

    if (error) {
      console.error('Error loading foods:', error);
    } else {
      setFoods(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.alimento.trim()) {
      alert('Nome do alimento e obrigatorio');
      return;
    }

    setSaving(true);

    try {
      const foodData = {
        alimento: formData.alimento.trim(),
        caloria: formData.caloria || '0',
        proteina: formData.proteina || '0',
        carboidrato: formData.carboidrato || '0',
        fibra: formData.fibra || '0',
        gordura: formData.gordura || '0'
      };

      if (editingFood) {
        const { error } = await supabase
          .from('tabela_taco')
          .update(foodData)
          .eq('id', editingFood.id);

        if (error) {
          console.error('Update error:', error);
          alert('Erro ao atualizar: ' + error.message);
          setSaving(false);
          return;
        }
      } else {
        const { error } = await supabase
          .from('tabela_taco')
          .insert(foodData);

        if (error) {
          console.error('Insert error:', error);
          alert('Erro ao adicionar: ' + error.message);
          setSaving(false);
          return;
        }
      }

      resetForm();
      await loadFoods();
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error saving food:', err);
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (food: Food) => {
    setEditingFood(food);
    setFormData({
      alimento: food.alimento || '',
      caloria: food.caloria || '',
      proteina: food.proteina || '',
      carboidrato: food.carboidrato || '',
      fibra: food.fibra || '',
      gordura: food.gordura || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (food: Food) => {
    if (!confirm(`Tem certeza que deseja excluir "${food.alimento}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('tabela_taco')
        .delete()
        .eq('id', food.id);

      if (error) throw error;
      loadFoods();
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error deleting food:', err);
      alert('Erro ao excluir: ' + err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      alimento: '',
      caloria: '',
      proteina: '',
      carboidrato: '',
      fibra: '',
      gordura: ''
    });
    setEditingFood(null);
    setShowModal(false);
  };

  const filteredFoods = foods.filter(food =>
    food.alimento.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatValue = (value: string) => {
    if (!value || value === '0') return '-';
    return value;
  };

  return (
    <div className={styles.container}>
      <div className={styles.actionsBar}>
        <div className={styles.searchWrapper}>
          <Input
            type="text"
            placeholder="Buscar alimento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<Search size={18} />}
          />
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className={styles.addButton}
        >
          <Plus size={18} />
          <span>Adicionar</span>
        </button>
      </div>

      <div className={styles.stats}>
        <p>Total: <strong>{foods.length}</strong> alimentos cadastrados</p>
      </div>

      <div className={styles.infoBox}>
        <p>Os valores nutricionais sao por <strong>100g</strong> do alimento. Use virgula para decimais (ex: 2,5).</p>
      </div>

      {loading ? (
        <div className={styles.loading}>Carregando...</div>
      ) : filteredFoods.length === 0 ? (
        <div className={styles.empty}>
          {searchTerm ? 'Nenhum alimento encontrado' : 'Nenhum alimento cadastrado'}
        </div>
      ) : (
        <div className={styles.list}>
          {filteredFoods.slice(0, 50).map((food) => (
            <Card key={food.id} className={styles.foodCard}>
              <div className={styles.foodInfo}>
                <h4 className={styles.foodName}>{food.alimento}</h4>
                <div className={styles.foodMacros}>
                  <span className={styles.macroKcal}>{formatValue(food.caloria)} kcal</span>
                  <span className={styles.macroP}>P: {formatValue(food.proteina)}g</span>
                  <span className={styles.macroC}>C: {formatValue(food.carboidrato)}g</span>
                  <span className={styles.macroG}>G: {formatValue(food.gordura || '0')}g</span>
                  <span className={styles.macroF}>F: {formatValue(food.fibra)}g</span>
                </div>
              </div>
              <div className={styles.foodActions}>
                <button
                  onClick={() => handleEdit(food)}
                  className={styles.editBtn}
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(food)}
                  className={styles.deleteBtn}
                >
                  Excluir
                </button>
              </div>
            </Card>
          ))}

          {filteredFoods.length > 50 && (
            <p className={styles.moreResults}>
              Mostrando 50 de {filteredFoods.length} resultados. Use a busca para filtrar.
            </p>
          )}
        </div>
      )}

      {showModal && (
        <div className={styles.modalOverlay} onClick={resetForm}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{editingFood ? 'Editar Alimento' : 'Novo Alimento'}</h3>
              <button onClick={resetForm} className={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formGroup}>
                <label>Nome do Alimento *</label>
                <input
                  type="text"
                  value={formData.alimento}
                  onChange={(e) => setFormData({ ...formData, alimento: e.target.value })}
                  placeholder="Ex: Arroz integral cozido"
                  required
                />
              </div>

              <p className={styles.formNote}>Valores nutricionais por 100g:</p>

              <div className={styles.formGroup}>
                <label>Calorias (kcal)</label>
                <input
                  type="text"
                  value={formData.caloria}
                  onChange={(e) => setFormData({ ...formData, caloria: e.target.value })}
                  placeholder="Ex: 124"
                />
              </div>

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Proteina (g)</label>
                  <input
                    type="text"
                    value={formData.proteina}
                    onChange={(e) => setFormData({ ...formData, proteina: e.target.value })}
                    placeholder="Ex: 2,5"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Carboidrato (g)</label>
                  <input
                    type="text"
                    value={formData.carboidrato}
                    onChange={(e) => setFormData({ ...formData, carboidrato: e.target.value })}
                    placeholder="Ex: 25,8"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Gordura (g)</label>
                  <input
                    type="text"
                    value={formData.gordura}
                    onChange={(e) => setFormData({ ...formData, gordura: e.target.value })}
                    placeholder="Ex: 1,0"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Fibra (g)</label>
                  <input
                    type="text"
                    value={formData.fibra}
                    onChange={(e) => setFormData({ ...formData, fibra: e.target.value })}
                    placeholder="Ex: 2,7"
                  />
                </div>
              </div>

              <div className={styles.formActions}>
                <button type="button" onClick={resetForm} className={styles.cancelBtn}>
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className={styles.submitBtn}>
                  {saving ? 'Salvando...' : editingFood ? 'Atualizar' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
