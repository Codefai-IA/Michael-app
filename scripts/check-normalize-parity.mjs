/**
 * Prova que src/utils/normalizeKey.ts e scripts/translate-content.mjs normalizam IGUAL.
 *
 * Se divergirem, a chave gravada pelo script nunca casa com a consultada pelo app e o aluno
 * simplesmente ve tudo em portugues — sem erro, sem log, sem pista. Este teste existe para
 * essa falha nao passar silenciosa.
 *
 * Uso: node scripts/check-normalize-parity.mjs
 */
import { readFileSync } from 'node:fs';

const body = /normalizeKey\(text[^)]*\)[^{]*\{([\s\S]*?)\n\}/;
const app = new Function('text', readFileSync('src/utils/normalizeKey.ts', 'utf8').match(body)[1].replace(/: string/g, ''));
const script = new Function('text', readFileSync('scripts/translate-content.mjs', 'utf8').match(body)[1]);

const CASES = [
  'Arroz, tipo 2, cru', 'Arroz tipo 2 cru', 'TRÍCEPS', 'TRICEPS', 'Triceps',
  'Café da Manhã', 'Cafe da Manha', 'LEG PRESS 45°', 'Pão   de forma  integral',
  'Costas e Bíceps', 'Frango, peito, sem pele, grelhado', '  ABDOMEM  ', 'Pós-Treino',
];

let failures = 0;
for (const c of CASES) {
  const a = app(c);
  const b = script(c);
  if (a !== b) {
    failures++;
    console.error(`DIVERGE ${JSON.stringify(c)}: app=${JSON.stringify(a)} script=${JSON.stringify(b)}`);
  }
}
console.log(failures ? `${failures} divergencias` : `OK — ${CASES.length} casos normalizam identicamente`);
process.exit(failures ? 1 : 0);
