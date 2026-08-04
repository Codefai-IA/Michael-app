// Helpers de YouTube reutilizados por receitas, vídeos da home, orientações e exercícios.
// Fonte unica da verdade: nao duplicar essas regras nas telas — foi assim que Shorts
// ficou de fora da validacao de Orientacoes por meses.

/** Segmentos de caminho que vem seguidos do ID do video. */
const PATH_PREFIXES = ['shorts', 'embed', 'live', 'v'];

/** IDs do YouTube sao alfanumericos com hifen/underscore (hoje 11 chars). */
const ID_PATTERN = /^[A-Za-z0-9_-]{6,}$/;

function sanitize(id: string | null | undefined): string | null {
  if (!id) return null;
  // Corta sufixos colados ao ID: "ID?si=x", "ID&t=10", "ID#frag", "ID/"
  const clean = id.split(/[?&#/]/)[0];
  return ID_PATTERN.test(clean) ? clean : null;
}

export function getYoutubeId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // Caminho principal: parse de URL de verdade, que aguenta qualquer ordem de
  // query string (ex: youtube.com/watch?app=desktop&v=ID) e subdominios (m., music.)
  try {
    // Aceita link colado sem protocolo ("youtube.com/watch?v=ID")
    const parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const segments = parsed.pathname.split('/').filter(Boolean);

    if (host === 'youtu.be') {
      return sanitize(segments[0]);
    }

    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      if (segments.length >= 2 && PATH_PREFIXES.includes(segments[0].toLowerCase())) {
        return sanitize(segments[1]);
      }
      return sanitize(parsed.searchParams.get('v'));
    }
  } catch {
    // URL malformada: cai no regex abaixo
  }

  // Fallback textual (ex: link dentro de um texto maior)
  const patterns = [
    /youtube\.com\/watch\?(?:[^\s]*&)?v=([^&\s]+)/,
    /youtu\.be\/([^?\s]+)/,
    new RegExp(`youtube\\.com/(?:${PATH_PREFIXES.join('|')})/([^?\\s]+)`),
  ];
  for (const p of patterns) {
    const m = trimmed.match(p);
    if (m) {
      const id = sanitize(m[1]);
      if (id) return id;
    }
  }
  return null;
}

/** Mensagem unica para quando o link nao e reconhecido. */
export const YOUTUBE_URL_ERROR = 'Link invalido. Use um link do YouTube (video, Short ou youtu.be).';

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
