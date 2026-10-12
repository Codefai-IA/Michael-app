import { useState } from 'react';
import { avatarThumbUrl } from '../../utils/avatar';

/**
 * Foto de perfil em miniatura para listas (ranking, lista de alunos do admin). Antes cada item
 * baixava a foto original (1,5 a 3 MB); agora baixa a miniatura (~4 KB). Se a transformacao
 * falhar, cai para a foto original.
 */
export function AvatarImage({ src, alt = '' }: { src: string; alt?: string }) {
  const [useOriginal, setUseOriginal] = useState(false);
  return (
    <img
      src={useOriginal ? src : avatarThumbUrl(src)}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setUseOriginal(true)}
    />
  );
}
