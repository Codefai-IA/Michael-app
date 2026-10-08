/**
 * Casos de borda da progressao de carga do aluno (src/utils/loadProgression.ts).
 *
 * Empacota o .ts com o esbuild (ja vem com o vite) e roda os casos. Rodar tambem com outro fuso
 * para garantir que a semana nao depende do relogio do aparelho:
 *   node scripts/check-load-progression.mjs
 *   TZ=Europe/London node scripts/check-load-progression.mjs
 */
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';

const dir = mkdtempSync(join(tmpdir(), 'lp-'));
const out = join(dir, 'lp.mjs');
await build({ entryPoints: ['src/utils/loadProgression.ts'], bundle: true, format: 'esm', outfile: out, logLevel: 'error' });
const lp = await import(pathToFileURL(out).href);
rmSync(dir, { recursive: true, force: true });

let falhas = 0;
const eq = (nome, got, exp) => {
  const ok = JSON.stringify(got) === JSON.stringify(exp);
  if (!ok) {
    falhas++;
    console.log(`FALHOU ${nome}\n  esperado: ${JSON.stringify(exp)}\n  obtido:   ${JSON.stringify(got)}`);
  }
};

// Semana: 2026-09-28 e segunda; 2026-10-04 domingo; 2026-10-05 segunda seguinte.
eq('segunda e a propria', lp.weekStartKey('2026-09-28'), '2026-09-28');
eq('domingo fecha a semana', lp.weekStartKey('2026-10-04'), '2026-09-28');
eq('virada para a segunda', lp.weekStartKey('2026-10-05'), '2026-10-05');
eq('virada de ano', lp.weekStartKey('2027-01-01'), '2026-12-28');
eq('janela de 12 semanas', lp.progressionStartDate('2026-10-01'), '2026-07-13');

const supino = { id: 'ex-novo', name: 'Supino Reto' };
eq('mesmo id (renomeado)', lp.matchesExercise(supino, 'ex-novo', 'Supino reto c/ barra'), true);
eq('mesmo nome, id novo', lp.matchesExercise(supino, 'ex-velho', 'supino  reto'), true);
eq('acento e maiuscula', lp.matchesExercise({ id: 'x', name: 'Tríceps Corda' }, 'y', 'TRICEPS corda'), true);
eq('outro exercicio', lp.matchesExercise(supino, 'ex-outro', 'Supino Inclinado'), false);
eq('log sem nome (exercicio apagado)', lp.matchesExercise(supino, 'ex-apagado', undefined), false);

const names = new Map([
  ['ex-velho', 'Supino reto'],   // antes do template ser reaplicado
  ['ex-novo', 'Supino Reto'],    // depois
  ['ex-outro', 'Agachamento'],
]);
const logs = [
  { exercise_id: 'ex-velho', date: '2026-09-15', sets_completed: [{ set: 1, weight: 40, reps: 10 }, { set: 2, weight: 42.5, reps: 8 }] },
  { exercise_id: 'ex-velho', date: '2026-09-17', sets_completed: [{ set: 1, weight: 41, reps: 10 }] },
  { exercise_id: 'ex-novo', date: '2026-09-29', sets_completed: [{ set: 1, weight: 45, reps: 8 }] },
  { exercise_id: 'ex-novo', date: '2026-10-01', sets_completed: [{ set: 1, weight: 0, reps: 0 }] }, // auto-save vazio
  { exercise_id: 'ex-outro', date: '2026-09-30', sets_completed: [{ set: 1, weight: 100, reps: 5 }] },
  { exercise_id: 'ex-velho', date: '2026-07-01', sets_completed: [{ set: 1, weight: 30, reps: 10 }] }, // fora da janela
  { exercise_id: 'ex-apagado', date: '2026-09-20', sets_completed: [{ set: 1, weight: 99, reps: 1 }] },
];
const p = lp.buildProgression(logs, names, supino, '2026-10-01');
eq('semanas', p.weekly, [
  { weekStart: '2026-09-14', maxWeight: 42.5 },
  { weekStart: '2026-09-28', maxWeight: 45 },
]);
eq('sessoes (recente primeiro, sem zeradas)', p.sessions.map((s) => s.date), ['2026-09-29', '2026-09-17', '2026-09-15']);
eq('ultima semana', p.latest, { weekStart: '2026-09-28', maxWeight: 45 });
eq('semana anterior', p.previous, { weekStart: '2026-09-14', maxWeight: 42.5 });

// So reps (prancha, abdominal): historico sim, grafico nao.
const reps = lp.buildProgression(
  [{ exercise_id: 'abd', date: '2026-09-30', sets_completed: [{ set: 1, weight: 0, reps: 20 }] }],
  new Map([['abd', 'Abdominal']]),
  { id: 'abd', name: 'Abdominal' },
  '2026-10-01'
);
eq('so reps: sem barras', reps.weekly, []);
eq('so reps: com historico', reps.sessions.length, 1);
eq('so reps: sem comparacao', [reps.latest, reps.previous], [null, null]);

// Valores vindos como string/nulos do JSON nao quebram.
const sujo = lp.buildProgression(
  [{ exercise_id: 'a', date: '2026-09-30', sets_completed: [{ set: '1', weight: '50', reps: null }] }, { exercise_id: 'a', date: '2026-09-29', sets_completed: null }],
  new Map([['a', 'Remada']]),
  { id: 'a', name: 'Remada' },
  '2026-10-01'
);
eq('valores sujos', sujo.weekly, [{ weekStart: '2026-09-28', maxWeight: 50 }]);

console.log(`TZ=${process.env.TZ ?? '(local)'} | ${falhas ? `${falhas} FALHA(S)` : 'todos os casos OK'}`);
if (falhas) process.exit(1);
