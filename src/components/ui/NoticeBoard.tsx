import { Megaphone } from 'lucide-react';
import styles from './NoticeBoard.module.css';

interface NoticeBoardProps {
  title?: string | null;
  text?: string | null;
  active?: boolean | null;
}

/**
 * Aviso global da Home: faixa discreta com o recado do admin.
 * Fica visivel enquanto estiver ativo (o aluno ve toda vez que abre o app),
 * por isso o formato minimalista de uma linha.
 */
export function NoticeBoard({ title, text, active }: NoticeBoardProps) {
  if (!active) return null;

  const heading = title?.trim();
  const body = text?.trim();
  if (!heading && !body) return null;

  return (
    <div className={styles.notice} role="status">
      <Megaphone size={14} className={styles.icon} />
      <p className={styles.message}>
        {heading && <strong className={styles.heading}>{heading}</strong>}
        {heading && body && <span className={styles.separator}>·</span>}
        {body}
      </p>
    </div>
  );
}
