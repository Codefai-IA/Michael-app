/**
 * Gera as traducoes do conteudo do banco (alimentos, exercicios, refeicoes, tipos de treino)
 * e grava em content_translations com status 'pending', para o admin revisar na Biblioteca.
 *
 * Por que nao traduz direto para 'approved': termo tecnico de academia e nutricao erra facil
 * ("Rosca Direta", "Leg Press 45", nomes da tabela TACO), e o aluno so pode ver o que o
 * treinador conferiu.
 *
 * E' idempotente: o que ja esta 'approved' nao e regerado, entao da para rodar de novo toda
 * vez que o treinador cadastrar exercicio ou alimento novo.
 *
 * Uso:
 *   node scripts/translate-content.mjs --dry-run     # so mostra o que faria
 *   node scripts/translate-content.mjs               # gera e grava como pending
 *
 * Requer no .env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
 */
import { readFileSync } from 'node:fs';

const DRY_RUN = process.argv.includes('--dry-run');
const LOCALE = 'en';
const BATCH_SIZE = 50;
const MODEL = 'claude-sonnet-5';

// ---------------------------------------------------------------- env
function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync('.env', 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    // sem .env: usa so o ambiente
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = env.ANTHROPIC_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Faltam VITE_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
if (!ANTHROPIC_KEY && !DRY_RUN) {
  console.error('Falta ANTHROPIC_API_KEY (ou rode com --dry-run).');
  process.exit(1);
}

// --------------------------------------------- normalizacao (espelha src/utils/normalizeKey.ts)
// Precisa ser IDENTICA a do app, senao a chave gravada aqui nunca casa com a consultada la.
function normalizeKey(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------- supabase REST
async function sb(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${path}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

/** PostgREST devolve no maximo 1000 linhas por request. */
async function fetchAll(table, column) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await sb(`${table}?select=${column}&limit=1000&offset=${offset}`);
    out.push(...page.map((r) => r[column]).filter((v) => v && String(v).trim()));
    if (page.length < 1000) break;
  }
  return out;
}

// ---------------------------------------------------------------- coleta
const SOURCES = [
  { entity: 'food', table: 'meal_foods', column: 'food_name' },
  { entity: 'food', table: 'tabela_taco', column: 'alimento' },
  { entity: 'food', table: 'food_metadata', column: 'nome_simplificado' },
  { entity: 'food', table: 'food_substitutions', column: 'substitute_food' },
  { entity: 'food', table: 'food_equivalences', column: 'food_name' },
  { entity: 'food', table: 'food_equivalence_groups', column: 'name' },
  { entity: 'exercise', table: 'exercises', column: 'name' },
  { entity: 'exercise', table: 'exercise_library', column: 'name' },
  { entity: 'muscle_group', table: 'exercise_library', column: 'muscle_group' },
  { entity: 'meal', table: 'meals', column: 'name' },
  { entity: 'meal', table: 'extra_meals', column: 'meal_name' },
  { entity: 'workout_type', table: 'daily_workouts', column: 'workout_type' },
  { entity: 'recipe', table: 'recipes', column: 'title' },
];

const GLOSSARY = {
  food: 'Nomes de alimentos (muitos vem da tabela TACO brasileira). Use o nome usual do alimento em ingles americano. Mantenha qualificadores como "cru"/"raw", "grelhado"/"grilled", "cozido"/"cooked". Nao traduza marcas.',
  exercise: 'Nomes de exercicios de academia. Use a nomenclatura padrao de musculacao em ingles (ex.: "Rosca Direta" -> "Barbell Curl", "Leg Press 45" -> "45-Degree Leg Press", "Agachamento Livre" -> "Back Squat"). Preserve numeros e angulos.',
  muscle_group: 'Grupos musculares. Use o termo padrao (ex.: "Costas" -> "Back", "MMII" -> "Lower Body", "Abdomem" -> "Abs").',
  meal: 'Nomes de refeicoes (ex.: "Cafe da Manha" -> "Breakfast", "Ceia" -> "Late-Night Snack").',
  workout_type: 'Tipos/divisoes de treino (ex.: "Costas e Biceps" -> "Back and Biceps", "Inferiores" -> "Lower Body", "Descanso" -> "Rest").',
  recipe: 'Titulos de receitas.',
  notice: 'Avisos curtos do treinador para os alunos.',
};

async function translateBatch(entity, items) {
  const list = items.map((it, i) => `${i + 1}. ${it.sample}`).join('\n');
  const prompt = `Traduza de portugues do Brasil para ingles americano os termos abaixo, do contexto de fitness e nutricao.

Contexto: ${GLOSSARY[entity] ?? ''}

Regras:
- Preserve o estilo de capitalizacao do original (se veio em MAIUSCULAS, devolva em MAIUSCULAS).
- Preserve numeros, graus e simbolos.
- Traduza apenas o termo, sem explicacao.
- Responda SOMENTE com um array JSON: [{"n": 1, "en": "..."}, ...] com uma entrada por item.

Termos:
${list}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const text = data.content.map((c) => c.text ?? '').join('');
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`Resposta sem JSON: ${text.slice(0, 200)}`);

  const parsed = JSON.parse(match[0]);
  const byIndex = new Map(parsed.map((p) => [Number(p.n), String(p.en ?? '').trim()]));

  return items.map((it, i) => ({ ...it, en: byIndex.get(i + 1) ?? '' }));
}

// ---------------------------------------------------------------- main
async function main() {
  console.log(DRY_RUN ? '== DRY RUN ==\n' : '== gerando traducoes ==\n');

  // 1. coletar e deduplicar por (entity, chave normalizada)
  const found = new Map();
  for (const src of SOURCES) {
    let values;
    try {
      values = await fetchAll(src.table, src.column);
    } catch (err) {
      console.warn(`  ! pulando ${src.table}.${src.column}: ${err.message.slice(0, 80)}`);
      continue;
    }
    for (const raw of values) {
      const text = String(raw).trim();
      const key = normalizeKey(text);
      if (!key) continue;
      const id = `${src.entity}::${key}`;
      if (!found.has(id)) found.set(id, { entity: src.entity, key, sample: text, count: 0 });
      found.get(id).count++;
    }
    console.log(`  ${src.table}.${src.column}: ${values.length} valores`);
  }
  console.log(`\ntotal distinto: ${found.size}`);

  // 2. tirar o que ja foi aprovado (idempotencia)
  let existing = [];
  try {
    existing = await sb(
      `content_translations?select=entity_type,source_key,status&locale=eq.${LOCALE}&limit=10000`
    );
  } catch (err) {
    // Tabela ainda nao criada: da para rodar --dry-run antes de aplicar o SQL.
    if (String(err.message).includes('PGRST205')) {
      console.warn('  ! content_translations ainda nao existe (rode sql/content_translations.sql)\n');
      if (!DRY_RUN) process.exit(1);
    } else {
      throw err;
    }
  }
  const approved = new Set(
    existing.filter((r) => r.status === 'approved').map((r) => `${r.entity_type}::${r.source_key}`)
  );
  const todo = [...found.values()].filter((it) => !approved.has(`${it.entity}::${it.key}`));
  console.log(`ja aprovados: ${approved.size} | a gerar: ${todo.length}\n`);

  if (!todo.length) return console.log('nada a fazer.');

  if (DRY_RUN) {
    const byEntity = {};
    for (const it of todo) (byEntity[it.entity] ??= []).push(it.sample);
    for (const [entity, samples] of Object.entries(byEntity)) {
      console.log(`${entity}: ${samples.length}`);
      console.log(`  ex.: ${samples.slice(0, 5).join(' | ')}`);
    }
    return;
  }

  // 3. traduzir em lotes por entidade
  const rows = [];
  const byEntity = {};
  for (const it of todo) (byEntity[it.entity] ??= []).push(it);

  for (const [entity, items] of Object.entries(byEntity)) {
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      process.stdout.write(`  ${entity} ${i + 1}-${i + batch.length}/${items.length}... `);
      try {
        const out = await translateBatch(entity, batch);
        for (const r of out) {
          // Traducao vazia e descartada: melhor cair no original em pt do que gravar vazio.
          if (!r.en) {
            console.warn(`\n    ! sem traducao para ${r.sample}`);
            continue;
          }
          rows.push({
            entity_type: entity,
            source_key: r.key,
            source_sample: r.sample,
            locale: LOCALE,
            translated_text: r.en,
            status: 'pending',
            origin: 'llm',
          });
        }
        console.log('ok');
      } catch (err) {
        console.log(`FALHOU: ${err.message.slice(0, 120)}`);
      }
    }
  }

  // 4. gravar
  console.log(`\ngravando ${rows.length} linhas...`);
  for (let i = 0; i < rows.length; i += 200) {
    await sb('content_translations?on_conflict=entity_type,source_key,locale', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows.slice(i, i + 200)),
    });
  }
  console.log('pronto. Revise na Biblioteca > Traducoes antes de liberar para os alunos.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
