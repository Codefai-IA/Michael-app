import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getYoutubeEmbedUrl, getYoutubeId, YOUTUBE_URL_ERROR } from '../../lib/youtube';
import { Button, GuidelineText } from '../ui';
import styles from './DefaultGuidelinesManager.module.css';

/**
 * Orientacoes padrao (linha unica de app_settings). Sao COPIADAS para patient_guidelines quando o
 * admin cria um aluno novo (AddClientModal). Mudar aqui nao altera os alunos que ja existem — para
 * esses, a tela de orientacoes do aluno tem o botao "Usar padrao".
 */
export function DefaultGuidelinesManager() {
  const [supplements, setSupplements] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchDefaults = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('app_settings')
      .select('default_recommended_supplements, default_free_meal_video_url')
      .limit(1)
      .maybeSingle();

    if (error) console.error('Erro ao carregar orientacoes padrao:', error);
    setSupplements(data?.default_recommended_supplements || '');
    setVideoUrl(data?.default_free_meal_video_url || '');
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDefaults();
  }, [fetchDefaults]);

  const embedUrl = getYoutubeEmbedUrl(videoUrl);

  const handleSave = async () => {
    if (videoUrl.trim() && !getYoutubeId(videoUrl)) {
      alert(YOUTUBE_URL_ERROR);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        default_recommended_supplements: supplements.trim() || null,
        default_free_meal_video_url: videoUrl.trim() || null,
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

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error: unknown) {
      console.error('Erro ao salvar orientacoes padrao:', error);
      alert('Erro ao salvar: ' + (error instanceof Error ? error.message : String(error)));
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
        <ClipboardList size={18} className={styles.descIcon} />
        <p>
          Estas orientações já vêm preenchidas em todo <strong>aluno novo</strong>. Os alunos que já
          existem não mudam — para eles, use o botão <strong>“Usar padrão”</strong> na tela de
          Orientações do aluno.
        </p>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="default-supplements">Suplementos indicados (padrão)</label>
        <textarea
          id="default-supplements"
          value={supplements}
          onChange={(e) => { setSupplements(e.target.value); setSaved(false); }}
          className={styles.textarea}
          placeholder="Cole aqui a lista de suplementos indicados"
          rows={14}
        />
        <span className={styles.hint}>Formato: TÍTULO EM MAIÚSCULAS vira seção · nome da marca seguido de ✅/❌ vira card · ✅ aprovado · ❌ evitar · ⭐ destaque · “Obs.:” nota · “Rótulo: a • b” vira etiquetas.</span>
      </div>

      {supplements.trim() && (
        <div className={styles.field}>
          <span className={styles.label}>Prévia (como o aluno vê)</span>
          <div className={styles.preview}>
            <GuidelineText text={supplements} />
          </div>
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="default-free-meal-video">Vídeo da refeição livre (padrão)</label>
        <input
          id="default-free-meal-video"
          type="url"
          value={videoUrl}
          onChange={(e) => { setVideoUrl(e.target.value); setSaved(false); }}
          className={styles.input}
          placeholder="https://youtube.com/watch?v=..."
        />
        {videoUrl.trim() && !embedUrl && <span className={styles.error}>{YOUTUBE_URL_ERROR}</span>}
      </div>

      {embedUrl && (
        <div className={styles.videoWrapper}>
          <iframe
            className={styles.videoFrame}
            src={embedUrl}
            title="Prévia do vídeo da refeição livre"
            frameBorder="0"
            allowFullScreen
          />
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
        ) : 'Salvar orientações padrão'}
      </Button>
    </div>
  );
}
