/**
 * Chave canonica de traducao de conteudo.
 *
 * O conteudo do aluno (meal_foods.food_name, exercises.name, meals.name,
 * daily_workouts.workout_type) e texto livre copiado na hora em que o treinador monta o
 * plano — nao ha FK para os catalogos. Por isso a traducao e resolvida por TEXTO, e esta
 * funcao e o que faz a chave do app bater com a chave gravada em content_translations.
 *
 * Precisa rodar identica no app (browser) e no script de traducao (Node), por isso e uma
 * funcao pura sem dependencia de DOM nem de extensao do Postgres (unaccent). Se a
 * normalizacao fosse feita em SQL, qualquer divergencia entre o unaccent do Postgres e o
 * NFD do JS viraria "traducao nao encontrada" silenciosa.
 *
 * Efeito colateral desejado: colapsa as variacoes de digitacao do treinador
 * (TRICEPS / TRÍCEPS / Triceps -> "triceps"), que hoje sujam exercise_library.muscle_group.
 *
 * ATENCAO: mudar esta funcao invalida TODAS as chaves ja gravadas. Se precisar mudar,
 * suba o KEY_VERSION e rode o script de traducao de novo.
 */
export const KEY_VERSION = 1;

export function normalizeKey(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/,/g, ' ') // virgula vira espaco ("Arroz, tipo 2" == "Arroz tipo 2")
    .replace(/\s+/g, ' ') // colapsa espacos
    .trim();
}

/**
 * Remove acentos preservando maiusculas/minusculas.
 * Usado onde o texto continua sendo exibido, nao virando chave.
 */
export function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
