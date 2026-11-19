/**
 * Posicao do balao do tutorial: abaixo do destaque se couber, senao acima, senao preso na parte de baixo da
 * tela (destaque maior que a tela). Funcao pura para testar sem DOM.
 */
export interface Rect { top: number; left: number; width: number; height: number }
export interface Viewport { width: number; height: number }
export interface Placement { top: number; left: number; width: number; side: 'below' | 'above' | 'bottom' }

export const TOUR_GUTTER = 16;
export const TOUR_GAP = 14;
export const TOUR_MAX_WIDTH = 360;

export function placeTooltip(target: Rect, tipHeight: number, vp: Viewport, bottomInset = 0): Placement {
  const width = Math.min(TOUR_MAX_WIDTH, vp.width - TOUR_GUTTER * 2);
  const center = target.left + target.width / 2;
  const left = Math.min(Math.max(center - width / 2, TOUR_GUTTER), vp.width - TOUR_GUTTER - width);
  const floor = vp.height - bottomInset - TOUR_GUTTER;

  const below = target.top + target.height + TOUR_GAP;
  if (below + tipHeight <= floor) return { top: below, left, width, side: 'below' };

  const above = target.top - TOUR_GAP - tipHeight;
  if (above >= TOUR_GUTTER) return { top: above, left, width, side: 'above' };

  return { top: Math.max(TOUR_GUTTER, floor - tipHeight), left, width, side: 'bottom' };
}

/** Chave do "ja viu" por tutorial e por aluno (dois alunos no mesmo aparelho veem cada um o seu). Guarda a lista de passos ja vistos. */
export const tourSeenKey = (id: string, userId: string | null | undefined) => `michael-tour:${id}:${userId ?? 'anon'}`;
