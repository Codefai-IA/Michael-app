import styles from './StampedImage.module.css';

interface StampedImageProps {
  src: string;
  /** ISO timestamp do momento da captura (checkin_photos.taken_at). */
  takenAt: string;
  alt?: string;
  className?: string;
  /** Tamanho do carimbo. 'sm' para thumbnails, 'md' para visualização expandida. */
  size?: 'sm' | 'md';
}

/** Formata ISO -> "DD/MM/AAAA - HH:MM" no fuso de Brasília. */
export function formatStamp(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('day')}/${get('month')}/${get('year')} - ${get('hour')}:${get('minute')}`;
}

/**
 * Imagem com carimbo de data/hora sobreposto (overlay na UI).
 * A foto crua vive no Storage; o timestamp vem do banco e é desenhado por cima
 * na exibição — auditoria social sem reprocessar a imagem.
 */
export function StampedImage({ src, takenAt, alt = '', className, size = 'md' }: StampedImageProps) {
  return (
    <div className={`${styles.wrap} ${className ?? ''}`}>
      <img src={src} alt={alt} className={styles.img} />
      <span className={`${styles.stamp} ${size === 'sm' ? styles.stampSm : ''}`}>
        {formatStamp(takenAt)}
      </span>
    </div>
  );
}
