/**
 * Cache em memoria do ultimo resultado de cada tela (Treino, Ranking).
 *
 * Ao reabrir a aba, a tela aparece na hora com o que ja foi carregado e a busca nova roda por
 * tras, substituindo os dados quando chega. Fica so na memoria da aba: some ao fechar/recarregar
 * o app e e limpo no logout. As chaves sempre levam o id do aluno.
 */
const store = new Map<string, unknown>();

export function getPageCache<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function setPageCache<T>(key: string, value: T): void {
  store.set(key, value);
}

export function clearPageCache(): void {
  store.clear();
}
