import { Languages } from 'lucide-react';
import type { Locale } from '../../types/database';
import styles from './ClientLocaleBadge.module.css';

interface ClientLocaleBadgeProps {
  locale: Locale | null | undefined;
  /** Texto extra dizendo o que o admin deve fazer nesta tela especifica. */
  hint?: string;
}

/**
 * Avisa o treinador que este aluno le o app em ingles.
 *
 * Existe porque texto livre (orientacoes, anamnese, observacoes de exercicio, notas) NAO e
 * traduzido automaticamente — a decisao foi que o admin escreve direto no idioma do aluno.
 * Sem este aviso, o treinador escreveria em portugues sem perceber.
 *
 * Nao renderiza nada para aluno pt-BR, que e o caso dos 267 atuais.
 */
export function ClientLocaleBadge({ locale, hint }: ClientLocaleBadgeProps) {
  if (locale !== 'en') return null;

  return (
    <div className={styles.badge} role="note">
      <Languages size={15} className={styles.icon} />
      <span>
        <strong>Este aluno lê o app em inglês.</strong>{' '}
        {hint ?? 'Os textos que você escrever aqui não são traduzidos — escreva em inglês.'}
      </span>
    </div>
  );
}
