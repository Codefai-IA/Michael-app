// CHAVE — NAO LOCALIZAR: produz YYYY-MM-DD usado como chave de dia (horario de Brasilia).
export function getBrasiliaDate(): string {
  const now = new Date();
  const brasiliaOffset = -3 * 60;
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const brasiliaTime = new Date(utc + (brasiliaOffset * 60000));
  return brasiliaTime.toISOString().split('T')[0];
}

/**
 * Plano vencido = data de termino anterior a hoje (Brasilia). O proprio dia do termino ainda
 * conta como ativo, e sem data cadastrada nunca vence — mesma regra do bloqueio do app do aluno.
 *
 * Compara as strings YYYY-MM-DD direto: `new Date('2026-08-10')` e meia-noite UTC, que no
 * Brasil ainda e o dia anterior.
 */
/**
 * Dias que faltam ate o termino do plano (0 = vence hoje, negativo = ja venceu).
 * `null` quando nao ha data. As duas datas viram meia-noite UTC, entao a conta nao sofre
 * com fuso nem horario de verao.
 */
export function daysUntilPlanEnd(planEndDate: string | null | undefined): number | null {
  if (!planEndDate) return null;
  const end = Date.parse(`${planEndDate.slice(0, 10)}T00:00:00Z`);
  const today = Date.parse(`${getBrasiliaDate()}T00:00:00Z`);
  if (Number.isNaN(end)) return null;
  return Math.round((end - today) / 86_400_000);
}

export function isPlanExpired(planEndDate: string | null | undefined): boolean {
  if (!planEndDate) return false;
  return planEndDate.slice(0, 10) < getBrasiliaDate();
}
