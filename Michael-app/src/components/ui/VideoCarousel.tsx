import styles from './VideoCarousel.module.css';

interface VideoItem {
  url: string;
  title: string;
}

interface VideoCarouselProps {
  videos: VideoItem[];
}

function getYouTubeVideoId(url: string): string | null {
  if (!url) return null;
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
  return null;
}

export function VideoCarousel({ videos }: VideoCarouselProps) {
  if (!videos || videos.length === 0) return null;

  const validVideos = videos
    .map(v => ({ ...v, videoId: getYouTubeVideoId(v.url) }))
    .filter(v => v.videoId);

  if (validVideos.length === 0) return null;

  return (
    <section className={styles.carouselSection}>
      <h3 className={styles.sectionTitle}>Videos</h3>
      <div className={styles.carousel}>
        {validVideos.map((video, index) => (
          <div key={index} className={styles.videoCard}>
            <div className={styles.videoWrapper}>
              <iframe
                className={styles.videoFrame}
                src={`https://www.youtube.com/embed/${video.videoId}?rel=0&modestbranding=1`}
                title={video.title || `Video ${index + 1}`}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
              />
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
