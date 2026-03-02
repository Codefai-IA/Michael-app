import { useState, useEffect, useCallback } from 'react';
import { Trophy, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui';
import styles from './RankingGiftManager.module.css';

export function RankingGiftManager() {
  const [gift, setGift] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchGift = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('app_settings')
      .select('ranking_monthly_gift')
      .limit(1)
      .maybeSingle();

    if (data?.ranking_monthly_gift) {
      setGift(data.ranking_monthly_gift);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchGift();
  }, [fetchGift]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      let error;

      if (existing) {
        const result = await supabase
          .from('app_settings')
          .update({ ranking_monthly_gift: gift.trim() || null, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select();
        error = result.error;
        if (!error && (!result.data || result.data.length === 0)) {
          throw new Error('Permissao negada pelo banco de dados (RLS). Verifique as politicas de acesso.');
        }
      } else {
        const result = await supabase
          .from('app_settings')
          .insert({ ranking_monthly_gift: gift.trim() || null })
          .select();
        error = result.error;
        if (!error && (!result.data || result.data.length === 0)) {
          throw new Error('Permissao negada pelo banco de dados (RLS). Verifique as politicas de acesso.');
        }
      }

      if (error) throw error;

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error: any) {
      console.error('Error saving gift:', error);
      alert('Erro ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Carregando...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.description}>
        <Trophy size={18} className={styles.descIcon} />
        <p>Defina o <strong>premio do mes</strong> para o 1° lugar do ranking. Todos os alunos verao esse premio na pagina de ranking.</p>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Premio deste mes</label>
        <textarea
          value={gift}
          onChange={(e) => { setGift(e.target.value); setSaved(false); }}
          className={styles.textarea}
          placeholder="Ex: Camiseta exclusiva, 1 mes gratis, Whey Protein..."
          rows={3}
        />
      </div>

      {gift.trim() && (
        <div className={styles.preview}>
          <span className={styles.previewLabel}>Preview:</span>
          <div className={styles.previewBanner}>
            <Trophy size={16} />
            <span>1° lugar ganha: {gift.trim()}</span>
          </div>
        </div>
      )}

      <Button
        onClick={handleSave}
        disabled={saving}
        fullWidth
        className={saved ? styles.savedBtn : ''}
      >
        {saving ? 'Salvando...' : saved ? (
          <>
            <Check size={18} />
            Salvo!
          </>
        ) : 'Salvar Premio'}
      </Button>
    </div>
  );
}
