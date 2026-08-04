import { useState } from 'react';
import { Play } from 'lucide-react';
import { getYoutubeId, getYoutubeThumbnail, getYoutubeEmbedUrl } from '../../lib/youtube';
import styles from './VideoCarousel.module.css';

interface VideoItem {
  url: string;
  title: string;
}

interface VideoCarouselProps {
  videos: VideoItem[];
}

export function VideoCarousel({ videos }: VideoCarouselProps) {
  // Fachada: so o video clicado vira iframe, os demais ficam como thumbnail.
  // Evita o branding do YouTube (play vermelho + nome do canal) em todos os cards
  // e nao baixa o player inteiro em cada video do carrossel.
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);

  if (!videos || videos.length === 0) return null;

  const validVideos = videos
    .map(v => ({ ...v, videoId: getYoutubeId(v.url) }))
    .filter(v => v.videoId);

  if (validVideos.length === 0) return null;

  return (
    <section className={styles.carouselSection}>
      <h3 className={styles.sectionTitle}>Videos</h3>
      <div className={styles.carousel}>
        {validVideos.map((video, index) => (
          <div key={index} className={styles.videoCard}>
            <div className={styles.videoWrapper}>
              {playingIndex === index ? (
                <iframe
                  className={styles.videoFrame}
                  src={getYoutubeEmbedUrl(video.url, true) || undefined}
                  title={video.title || `Video ${index + 1}`}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <button
                  type="button"
                  className={styles.thumbButton}
                  onClick={() => setPlayingIndex(index)}
                  aria-label={video.title ? `Assistir ${video.title}` : `Assistir video ${index + 1}`}
                >
                  <img
                    className={styles.thumbImage}
                    src={getYoutubeThumbnail(video.url, 'maxres') || undefined}
                    alt=""
                    loading="lazy"
                    onError={(e) => {
                      // maxresdefault nao existe para todo video: cai para hqdefault
                      const fallback = getYoutubeThumbnail(video.url, 'hq');
                      const img = e.currentTarget;
                      if (fallback && img.src !== fallback) img.src = fallback;
                    }}
                  />
                  <span className={styles.playOverlay}>
                    <span className={styles.playButton}>
                      <Play size={22} fill="currentColor" />
                    </span>
                  </span>
                </button>
              )}
            </div>
            {video.title && (
              <p className={styles.videoTitle}>{video.title}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
