import { useState, useEffect, useCallback } from 'react';
import { Play, Trash2, Plus, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Card, Button } from '../ui';
import styles from './HomeVideosManager.module.css';

interface VideoItem {
  url: string;
  title: string;
}

const getVideoId = (url: string) => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&\s]+)/,
    /(?:youtu\.be\/)([^?\s]+)/,
    /(?:youtube\.com\/embed\/)([^?\s]+)/,
    /(?:youtube\.com\/shorts\/)([^?\s]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return '';
};

export function HomeVideosManager() {
  const [videoUrls, setVideoUrls] = useState<VideoItem[]>([]);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('app_settings')
      .select('home_video_urls')
      .limit(1)
      .maybeSingle();

    if (data?.home_video_urls) {
      setVideoUrls(data.home_video_urls as VideoItem[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const handleAddVideo = () => {
    if (!newVideoUrl.trim()) return;
    const videoId = getVideoId(newVideoUrl);
    if (!videoId) {
      alert('Cole um link valido do YouTube');
      return;
    }
    setVideoUrls(prev => [...prev, { url: newVideoUrl.trim(), title: newVideoTitle.trim() }]);
    setNewVideoUrl('');
    setNewVideoTitle('');
    setSaved(false);
  };

  const handleRemoveVideo = (index: number) => {
    setVideoUrls(prev => prev.filter((_, i) => i !== index));
    setSaved(false);
  };

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
          .update({ home_video_urls: videoUrls, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select();
        error = result.error;
        if (!error && (!result.data || result.data.length === 0)) {
          throw new Error('Permissao negada pelo banco de dados (RLS). Verifique as politicas de acesso.');
        }
      } else {
        const result = await supabase
          .from('app_settings')
          .insert({ home_video_urls: videoUrls })
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
      console.error('Error saving videos:', error);
      alert('Erro ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Carregando videos...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.description}>
        <Play size={18} className={styles.descIcon} />
        <p>Esses videos aparecerao na <strong>Home de todos os alunos</strong>, abaixo do banner principal.</p>
      </div>

      {/* Current video list */}
      {videoUrls.length > 0 && (
        <div className={styles.videoList}>
          {videoUrls.map((video, index) => {
            const vid = getVideoId(video.url);
            return (
              <div key={index} className={styles.videoItem}>
                <div className={styles.videoItemInfo}>
                  {vid && (
                    <img
                      src={`https://img.youtube.com/vi/${vid}/default.jpg`}
                      alt=""
                      className={styles.videoThumb}
                    />
                  )}
                  <div className={styles.videoItemText}>
                    <span className={styles.videoItemTitle}>{video.title || 'Sem titulo'}</span>
                    <span className={styles.videoItemUrl}>{video.url}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveVideo(index)}
                  className={styles.removeBtn}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {videoUrls.length === 0 && (
        <Card className={styles.emptyState}>
          <Play size={32} />
          <p>Nenhum video adicionado</p>
          <span>Adicione links do YouTube abaixo</span>
        </Card>
      )}

      {/* Add new video form */}
      <div className={styles.addForm}>
        <input
          type="url"
          value={newVideoUrl}
          onChange={(e) => setNewVideoUrl(e.target.value)}
          className={styles.input}
          placeholder="https://youtube.com/watch?v=..."
        />
        <input
          type="text"
          value={newVideoTitle}
          onChange={(e) => setNewVideoTitle(e.target.value)}
          className={styles.input}
          placeholder="Titulo do video (opcional)"
        />
        <Button variant="outline" onClick={handleAddVideo} size="sm">
          <Plus size={16} /> Adicionar Video
        </Button>
      </div>

      {/* Save Button */}
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
        ) : 'Salvar Videos'}
      </Button>
    </div>
  );
}
