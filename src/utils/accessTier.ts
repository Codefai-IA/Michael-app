import type { Profile } from '../types/database';

/**
 * Funil low ticket: o aluno criado pelo webhook de compra ve so estas rotas. As demais abas
 * continuam visiveis com cadeado e abrem a tela de upgrade (UpgradeScreen).
 */
const LOW_TICKET_ALLOWED_ROUTES = ['/app', '/app/treino', '/app/perfil'];

export function isLowTicket(profile: Pick<Profile, 'access_tier'> | null | undefined): boolean {
  return profile?.access_tier === 'low_ticket';
}

export function isRouteLocked(
  profile: Pick<Profile, 'access_tier'> | null | undefined,
  pathname: string
): boolean {
  if (!isLowTicket(profile)) return false;
  const path = pathname.replace(/\/+$/, '') || '/';
  return !LOW_TICKET_ALLOWED_ROUTES.includes(path);
}
