/**
 * Casos da lista de compras (src/utils/shoppingList.ts): categoria, peso cru, soma com opcoes e periodo.
 *
 * Os ids e calorias abaixo sao linhas reais da tabela_taco (conferidas em 19/11/2026).
 *   node scripts/check-shopping-list.mjs
 */
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';

const dir = mkdtempSync(join(tmpdir(), 'sl-'));
const out = join(dir, 'sl.mjs');
await build({ entryPoints: ['src/utils/shoppingList.ts'], bundle: true, format: 'esm', outfile: out, logLevel: 'error' });
const sl = await import(pathToFileURL(out).href);
rmSync(dir, { recursive: true, force: true });

let falhas = 0;
const eq = (nome, got, exp) => {
  const ok = JSON.stringify(got) === JSON.stringify(exp);
  if (!ok) {
    falhas++;
    console.log(`FALHOU ${nome}\n  esperado: ${JSON.stringify(exp)}\n  obtido:   ${JSON.stringify(got)}`);
  }
};
const near = (nome, got, exp, tol = 0.01) => {
  if (got == null || Math.abs(got - exp) > tol) {
    falhas++;
    console.log(`FALHOU ${nome}: esperado ~${exp}, obtido ${got}`);
  }
};

const taco = sl.buildTacoIndex([
  { id: 3, alimento: 'Arroz, tipo 1, cozido', caloria: '128' },
  { id: 4, alimento: 'Arroz, tipo 1, cru', caloria: '358' },
  { id: 63, alimento: 'Torrada, pão francês', caloria: '377' },
  { id: 64, alimento: 'Abóbora, cabotian, cozida', caloria: '48' },
  { id: 91, alimento: 'Batata, inglesa, cozida', caloria: '52' },
  { id: 92, alimento: 'Batata, inglesa, crua', caloria: '64' },
  { id: 120, alimento: 'Cará, cozido', caloria: '78' },
  { id: 162, alimento: 'Vagem, crua', caloria: '25' },
  { id: 163, alimento: 'Abacate, cru', caloria: '96' },
  { id: 260, alimento: 'Azeite, de oliva, extra virgem', caloria: '884' },
  { id: 324, alimento: 'Caldo de carne, tablete', caloria: '241' },
  { id: 377, alimento: 'Carne, bovina, patinho, sem gordura, grelhado', caloria: '219' },
  { id: 376, alimento: 'Carne, bovina, patinho, sem gordura, cru', caloria: '133' },
  { id: 396, alimento: 'Frango, coxa, com pele, assada', caloria: '215' },
  { id: 397, alimento: 'Frango, coxa, com pele, crua', caloria: '161' },
  { id: 446, alimento: 'Bebida láctea, pêssego', caloria: '55' },
  { id: 470, alimento: 'Bebida isotônica, sabores variados', caloria: '26' },
  { id: 488, alimento: 'Ovo, de galinha, inteiro, cozido/10minutos', caloria: '146' },
  { id: 489, alimento: 'Ovo, de galinha, inteiro, cru', caloria: '143' },
  { id: 490, alimento: 'Ovo, de galinha, inteiro, frito', caloria: '240' },
  { id: 513, alimento: 'Fermento em pó, químico', caloria: '90' },
  { id: 557, alimento: 'Amendoim, grão, cru', caloria: '544' },
  { id: 561, alimento: 'Feijão, carioca, cozido', caloria: '76' },
  { id: 562, alimento: 'Feijão, carioca, cru', caloria: '329' },
  { id: 597, alimento: 'Noz, crua', caloria: '620' },
  { id: 612, alimento: 'Peito de frango', caloria: '165' },
  { id: 650, alimento: 'PORÇÃO DE FRUTA', caloria: '80' },
  { id: 651, alimento: 'macarrão', caloria: '125' },
  { id: 665, alimento: 'Queijo mussarela', caloria: '320' },
  { id: 652, alimento: 'Pão de forma integral', caloria: '268' },
]);

// --- categoria nas fronteiras ---
eq('63 cereal', sl.categoryFor(63, 'Torrada, pão francês'), 'bases');
eq('64 verdura', sl.categoryFor(64, 'Abóbora, cabotian, cozida'), 'legumes');
eq('91 batata vira base', sl.categoryFor(91, 'Batata, inglesa, cozida'), 'bases');
eq('120 cara (acento) vira base', sl.categoryFor(120, 'Cará, cozido'), 'bases');
eq('162 verdura', sl.categoryFor(162, 'Vagem, crua'), 'legumes');
eq('163 fruta', sl.categoryFor(163, 'Abacate, cru'), 'frutas');
eq('260 gordura', sl.categoryFor(260, 'Azeite, de oliva, extra virgem'), 'complementos');
eq('324 caldo', sl.categoryFor(324, 'Caldo de carne, tablete'), 'complementos');
eq('377 carne', sl.categoryFor(377, 'Carne, bovina, patinho, sem gordura, grelhado'), 'proteinas');
eq('446 leite', sl.categoryFor(446, 'Bebida láctea, pêssego'), 'laticinios');
eq('470 bebida', sl.categoryFor(470, 'Bebida isotônica, sabores variados'), 'outros');
eq('489 ovo', sl.categoryFor(489, 'Ovo, de galinha, inteiro, cru'), 'proteinas');
eq('513 fermento', sl.categoryFor(513, 'Fermento em pó, químico'), 'complementos');
eq('557 amendoim', sl.categoryFor(557, 'Amendoim, grão, cru'), 'complementos');
eq('561 feijao', sl.categoryFor(561, 'Feijão, carioca, cozido'), 'bases');
eq('597 noz', sl.categoryFor(597, 'Noz, crua'), 'complementos');
eq('612 peito do Michael', sl.categoryFor(612, 'Peito de frango'), 'proteinas');
eq('665 mussarela', sl.categoryFor(665, 'Queijo mussarela'), 'laticinios');
eq('650 porcao de fruta', sl.categoryFor(650, 'PORÇÃO DE FRUTA'), 'frutas');
eq('sem id', sl.categoryFor(null, 'Alimento novo'), 'outros');
eq('id novo', sl.categoryFor(800, 'Alimento novo'), 'outros');
eq('prato pronto: salada de legumes', sl.categoryFor(546, 'Salada, de legumes, cozida no vapor'), 'legumes');
eq('prato pronto: feijoada fica em outros', sl.categoryFor(540, 'Feijoada'), 'outros');
eq('prato pronto: arroz carreteiro', sl.categoryFor(526, 'Arroz carreteiro'), 'bases');
eq('fora da TACO: legumes variados', sl.categoryFor(null, 'legumes variados'), 'legumes');
eq('fora da TACO: salada de frutas', sl.categoryFor(null, 'Salada de frutas'), 'frutas');
eq('fora da TACO: pao de queijo', sl.categoryFor(null, 'Pão de queijo caseiro'), 'bases');
eq('fora da TACO: clara de ovo', sl.categoryFor(null, 'Clara de ovo'), 'proteinas');
eq('fora da TACO: iogurte', sl.categoryFor(null, 'iogurte natural desnatado'), 'laticinios');
eq('fora da TACO: pasta de amendoim', sl.categoryFor(null, 'Pasta de amendoim'), 'complementos');
eq('fora da TACO: macarrao com acento', sl.categoryFor(null, 'Macarrão integral'), 'bases');
eq('fora da TACO: mamao', sl.categoryFor(null, 'Mamão papaya'), 'frutas');

// --- peso cru ---
near('arroz', sl.rawFactor('Arroz, tipo 1, cozido', taco), 128 / 358);
near('feijao', sl.rawFactor('Feijão, carioca, cozido', taco), 76 / 329);
near('patinho grelhado', sl.rawFactor('Carne, bovina, patinho, sem gordura, grelhado', taco), 219 / 133);
near('coxa assada (crua)', sl.rawFactor('Frango, coxa, com pele, assada', taco), 215 / 161);
near('peito do Michael', sl.rawFactor('Peito de frango', taco), 159 / 119);
near('macarrao do Michael', sl.rawFactor('macarrão', taco), 125 / 371);
eq('batata nao converte', sl.rawFactor('Batata, inglesa, cozida', taco), null);
eq('ovo cozido nao converte', sl.rawFactor('Ovo, de galinha, inteiro, cozido/10minutos', taco), null);
eq('frito nao converte', sl.rawFactor('Ovo, de galinha, inteiro, frito', taco), null);
eq('cru nao converte', sl.rawFactor('Arroz, tipo 1, cru', taco), null);
eq('fora da TACO', sl.rawFactor('Arroz, tipo 9, cozido', taco), null);
eq('legume cozido nao converte (ruido de kcal)', sl.rawFactor('Abóbora, cabotian, cozida', taco), null);
const taco2 = sl.buildTacoIndex([
  { id: 273, alimento: 'Abadejo, filé, congelado, assado', caloria: '112' },
  { id: 275, alimento: 'Abadejo, filé, congelado, cru', caloria: '59' },
  { id: 88, alimento: 'Batata, doce, cozida', caloria: '77' },
  { id: 89, alimento: 'Batata, doce, crua', caloria: '118' },
]);
near('peixe no teto 1,7', sl.rawFactor('Abadejo, filé, congelado, assado', taco2), 1.7);
eq('batata doce nao converte', sl.rawFactor('Batata, doce, cozida', taco2), null);

// --- dias das opcoes ---
eq('padrao', sl.defaultOptionDays(3), [7, 0, 0]);
eq('opcao 3 = 2 dias', sl.setOptionDays([7, 0, 0], 2, 2), [5, 0, 2]);
eq('opcao 3 volta 1', sl.setOptionDays([5, 0, 2], 2, 1), [6, 0, 1]);
eq('opcao 1 desce: vai p/ opcao 2', sl.setOptionDays([7, 0, 0], 0, 6), [6, 1, 0]);
eq('opcao 1 sobe: tira da ultima', sl.setOptionDays([4, 1, 2], 0, 6), [6, 1, 0]);
eq('opcao 2 sem dias na 1: tira da 3', sl.setOptionDays([0, 3, 4], 1, 5), [0, 5, 2]);
eq('normaliza soma errada', sl.normalizeOptionDays([3, 3], 2), [7, 0]);
eq('normaliza tamanho', sl.normalizeOptionDays([7], 3), [7, 0, 0]);
eq('mantem valido', sl.normalizeOptionDays([2, 5], 2), [2, 5]);

// --- soma ---
const f = (food_name, quantity, unit_type = 'gramas', quantity_units = null) => ({ food_name, quantity, unit_type, quantity_units });
const meals = [
  { id: 'almoco', foods: [f('Arroz, tipo 1, cozido', '120'), f('Feijão, carioca, cozido', '60'), f('Peito de frango', '100')], options: [] },
  { id: 'jantar', foods: [f('Arroz, tipo 1, cozido', '100'), f('Batata, inglesa, cozida', '150')], options: [[f('macarrão', '200'), f('Peito de frango', '120,5')]] },
  { id: 'cafe', foods: [f('Ovo, de galinha, inteiro, cozido/10minutos', '100', 'unidade', 2), f('Pão de forma integral', '50', 'fatia', 2), f('Leite', '200', 'ml', null)], options: [] },
  { id: 'lanche', foods: [f('PORÇÃO DE FRUTA', '80', 'porcao', 1)], options: [] },
];
const get = (list, key) => list.find((i) => i.key === key);

let list = sl.buildShoppingList({ meals, optionDays: {}, periodDays: 7, taco });
let arroz = get(list, 'Arroz, tipo 1, cozido');
near('arroz pronto 7d', arroz.amount.cookedGrams, (120 + 100) * 7);
near('arroz cru 7d', arroz.amount.grams, 220 * 7 * 128 / 358, 0.001);
eq('macarrao fora (opcao 2 com 0 dias)', get(list, 'macarrão'), undefined);
near('frango 7d so almoco', get(list, 'Peito de frango').amount.cookedGrams, 700);
eq('batata sem conversao', get(list, 'Batata, inglesa, cozida').amount, { kind: 'grams', grams: 1050, cookedGrams: null });
eq('ovos em unidade', get(list, 'Ovo, de galinha, inteiro, cozido/10minutos').amount, { kind: 'count', unit: 'unidade', count: 14, grams: 700 });
eq('pao em fatia', get(list, 'Pão de forma integral').amount, { kind: 'count', unit: 'fatia', count: 14, grams: 350 });
eq('leite em ml', get(list, 'Leite').amount, { kind: 'ml', ml: 1400 });
eq('porcao de fruta', get(list, 'PORÇÃO DE FRUTA'), { key: 'PORÇÃO DE FRUTA', category: 'frutas', amount: { kind: 'portions', count: 7 }, generic: true });

// jantar: 5 dias opcao 1, 2 dias opcao 2
list = sl.buildShoppingList({ meals, optionDays: { jantar: [5, 2] }, periodDays: 7, taco });
near('arroz com opcao', get(list, 'Arroz, tipo 1, cozido').amount.cookedGrams, 120 * 7 + 100 * 5);
near('macarrao 2 dias', get(list, 'macarrão').amount.cookedGrams, 400);
near('frango soma decimal', get(list, 'Peito de frango').amount.cookedGrams, 700 + 120.5 * 2);

// periodo 15 e 30
list = sl.buildShoppingList({ meals, optionDays: {}, periodDays: 15, taco });
near('feijao 15d', get(list, 'Feijão, carioca, cozido').amount.cookedGrams, 60 * 15);
eq('ovos 15d', get(list, 'Ovo, de galinha, inteiro, cozido/10minutos').amount.count, 30);
list = sl.buildShoppingList({ meals, optionDays: { jantar: [5, 2] }, periodDays: 30, taco });
near('macarrao 30d', get(list, 'macarrão').amount.cookedGrams, 200 * 2 * 30 / 7, 0.001);

// unidade quebrada arredonda para cima
list = sl.buildShoppingList({ meals: [{ id: 'm', foods: [f('Ovo, de galinha, inteiro, cru', '50', 'unidade', 1)], options: [] }], optionDays: {}, periodDays: 15, taco });
eq('15 ovos', get(list, 'Ovo, de galinha, inteiro, cru').amount.count, 15);
list = sl.buildShoppingList({ meals: [{ id: 'm', foods: [f('Ovo, de galinha, inteiro, cru', '50', 'unidade', 1)], options: [[f('Ovo, de galinha, inteiro, cru', '50', 'unidade', 1)]] }], optionDays: { m: [4, 3] }, periodDays: 30, taco });
eq('ovos 30d com opcao', get(list, 'Ovo, de galinha, inteiro, cru').amount.count, 30);

// ovo guardado em gramas vira unidades pelo peso por unidade
list = sl.buildShoppingList({
  meals: [{ id: 'm', foods: [f('Ovo, de galinha, inteiro, cru', '100')], options: [] }],
  optionDays: {}, periodDays: 7, taco,
  unitWeights: new Map([['Ovo, de galinha, inteiro, cru', { unit: 'unidade', grams: 50 }]]),
});
eq('ovo em gramas vira 14 unidades', get(list, 'Ovo, de galinha, inteiro, cru').amount, { kind: 'count', unit: 'unidade', count: 14, grams: 700 });
// alimento convertido para cru nao vira unidade
list = sl.buildShoppingList({
  meals: [{ id: 'm', foods: [f('Peito de frango', '100')], options: [] }],
  optionDays: {}, periodDays: 7, taco,
  unitWeights: new Map([['Peito de frango', { unit: 'unidade', grams: 150 }]]),
});
eq('frango segue em peso cru', get(list, 'Peito de frango').amount.kind, 'grams');

// quantidade zero / vazia some
list = sl.buildShoppingList({ meals: [{ id: 'm', foods: [f('Vagem, crua', ''), f('', '100')], options: [] }], optionDays: {}, periodDays: 7, taco });
eq('vazio some', list.length, 0);

// --- formatacao (arredonda para cima) ---
eq('g', sl.formatMass(301, 'pt-BR'), '310 g');
eq('g exato', sl.formatMass(300, 'pt-BR'), '300 g');
eq('g minimo', sl.formatMass(3, 'pt-BR'), '10 g');
eq('kg', sl.formatMass(1234, 'pt-BR'), '1,3 kg');
eq('kg exato', sl.formatMass(2000, 'pt-BR'), '2 kg');
eq('kg en', sl.formatMass(1234, 'en'), '1.3 kg');
eq('L', sl.formatVolume(1400, 'pt-BR'), '1,4 L');
eq('ml', sl.formatVolume(250, 'pt-BR'), '250 ml');

if (falhas) {
  console.log(`\n${falhas} falha(s)`);
  process.exit(1);
}
console.log('lista de compras: todos os casos OK');
