/**
 * Cache local das preferencias de idioma/unidades.
 *
 * Existe em arquivo separado (e nao dentro do AuthContext) porque e lido no primeiro render,
 * antes do profile chegar do banco: sem isso, um aluno em ingles veria a tela piscar em
 * portugues a cada refresh. E' o mesmo motivo pelo qual o AuthContext ja cacheia o role.
 *
 * Guarda apenas preferencia de exibicao — nada sensivel.
 */
const LOCALE_CACHE_KEY = 'mc_user_locale';
const UNITS_CACHE_KEY = 'mc_user_units';

export function getCachedLocale(): string | null {
  try {
    return localStorage.getItem(LOCALE_CACHE_KEY);
  } catch {
    return null;
  }
}

export function getCachedUnitSystem(): string | null {
  try {
    return localStorage.getItem(UNITS_CACHE_KEY);
  } catch {
    return null;
  }
}

export function setCachedPreferences(locale: string, unitSystem: string): void {
  try {
    localStorage.setItem(LOCALE_CACHE_KEY, locale);
    localStorage.setItem(UNITS_CACHE_KEY, unitSystem);
  } catch {
    // Ignorar erro de localStorage
  }
}

export function clearCachedPreferences(): void {
  try {
    localStorage.removeItem(LOCALE_CACHE_KEY);
    localStorage.removeItem(UNITS_CACHE_KEY);
  } catch {
    // Ignorar erro de localStorage
  }
}
