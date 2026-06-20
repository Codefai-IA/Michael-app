// Helpers de YouTube reutilizados por receitas, vídeos da home e exercícios.

export function getYoutubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&\s]+)/,
    /(?:youtu\.be\/)([^?\s]+)/,
    /(?:youtube\.com\/embed\/)([^?\s]+)/,
    /(?:youtube\.com\/shorts\/)([^?\s]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

type ThumbQuality = 'default' | 'mq' | 'hq' | 'sd' | 'maxres';

export function getYoutubeThumbnail(url: string, quality: ThumbQuality = 'hq'): string | null {
  const id = getYoutubeId(url);
  if (!id) return null;
  const map: Record<ThumbQuality, string> = {
    default: 'default',
    mq: 'mqdefault',
    hq: 'hqdefault',
    sd: 'sddefault',
    maxres: 'maxresdefault',
  };
  return `https://img.youtube.com/vi/${id}/${map[quality]}.jpg`;
}

export function getYoutubeEmbedUrl(url: string, autoplay = false): string | null {
  const id = getYoutubeId(url);
  if (!id) return null;
  const base = `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;
  return autoplay ? `${base}&autoplay=1` : base;
}
