import { useState, useEffect, useCallback } from 'react';
import { Megaphone, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button, NoticeBoard } from '../ui';
import styles from './HomeNoticeManager.module.css';

const SUGGESTIONS = [
  'Receita nova disponivel',
  'Planejamentos pendentes',
  'Feriado',
  'Atualizacao de dieta',
];

export function HomeNoticeManager() {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchNotice = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('app_settings')
      .select('home_notice_title, home_notice_text, home_notice_active')
      .limit(1)
      .maybeSingle();

    setTitle(data?.home_notice_title || '');
    setText(data?.home_notice_text || '');
    setActive(Boolean(data?.home_notice_active));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNotice();
  }, [fetchNotice]);

  const hasContent = Boolean(title.trim() || text.trim());

  const handleSave = async () => {
    if (active && !hasContent) {
      alert('Escreva um titulo ou uma mensagem para exibir o aviso.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        home_notice_title: title.trim() || null,
        home_notice_text: text.trim() || null,
        // Titulo sozinho ja e um aviso valido; so nao pode ficar ativo e vazio
        home_notice_active: active && hasContent,
      };

      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      const result = existing
        ? await supabase
            .from('app_settings')
            .update({ ...payload, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
            .select()
        : await supabase.from('app_settings').insert(payload).select();

      if (result.error) throw result.error;
      if (!result.data || result.data.length === 0) {
        throw new Error('Permissao negada pelo banco de dados (RLS). Verifique as politicas de acesso.');
      }

      setActive(payload.home_notice_active);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error: any) {
      console.error('Error saving notice:', error);
      alert('Erro ao salvar aviso: ' + error.message);
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
        <Megaphone size={18} className={styles.descIcon} />
        <p>Escreva um <strong>aviso</strong> para aparecer no topo da tela inicial de todos os alunos. E um aviso por vez: salvar substitui o anterior. Desligue quando nao for mais necessario.</p>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="notice-title">Titulo (opcional)</label>
        <input
          id="notice-title"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setSaved(false); }}
          className={styles.input}
          placeholder="Ex: Receita nova disponivel"
          maxLength={60}
        />
        <div className={styles.suggestions}>
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              type="button"
              className={styles.chip}
              onClick={() => { setTitle(s); setSaved(false); }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="notice-text">Mensagem</label>
        <textarea
          id="notice-text"
          value={text}
          onChange={(e) => { setText(e.target.value); setSaved(false); }}
          className={styles.textarea}
          placeholder="Ex: Subi 3 receitas novas na aba Dieta, corre conferir!"
          rows={4}
        />
      </div>

      <label className={styles.toggleRow}>
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => { setActive(e.target.checked); setSaved(false); }}
        />
        <span>Exibir aviso na tela inicial</span>
      </label>

      {hasContent && (
        <div className={styles.preview}>
          <span className={styles.previewLabel}>
            {active ? 'Preview (como o aluno ve):' : 'Preview (aviso desligado):'}
          </span>
          <NoticeBoard title={title} text={text} active />
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
        ) : 'Salvar Aviso'}
      </Button>
    </div>
  );
}
