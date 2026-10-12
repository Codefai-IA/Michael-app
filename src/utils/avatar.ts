/**
 * Miniatura de foto de perfil pelo endpoint de transformacao do Supabase Storage (/render/image).
 * As fotos do bucket `avatars` sao as originais (1,5 a 3 MB); a miniatura tem ~4 KB. Tamanho unico
 * (160 px, cobre 80 px em tela 2x) para a CDN reaproveitar a mesma miniatura em todas as telas.
 */
const THUMB_PX = 160;

export function avatarThumbUrl(url: string): string {
  if (!url.includes('/storage/v1/object/public/')) return url;
  const base = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
  return `${base}${base.includes('?') ? '&' : '?'}width=${THUMB_PX}&height=${THUMB_PX}&resize=cover`;
}
