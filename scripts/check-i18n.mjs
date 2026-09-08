/**
 * Sanidade dos dicionarios de i18n.
 *
 * O `tsc -b` ja garante que nao falta chave em en (Record<TKey,string>). Este script pega o
 * que o tipo NAO pega: valor vazio ou so espaco, que viraria texto sumido na tela do aluno,
 * e chave orfa em en depois de uma remocao em pt-BR.
 *
 * Uso: node scripts/check-i18n.mjs
 */
import { readFileSync } from 'fs';
const parse = (f) => {
  const s = readFileSync(f, 'utf8');
  const out = {};
  // aceita chave/valor tanto em aspas simples quanto duplas
  const re = /^\s*'([^']+)':\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"),?\s*$/gm;
  for (const m of s.matchAll(re)) out[m[1]] = m[2] !== undefined ? m[2] : m[3];
  return out;
};
const pt = parse('src/i18n/dict/pt-BR.ts');
const en = parse('src/i18n/dict/en.ts');
const falta = Object.keys(pt).filter(k => !(k in en));
const sobra = Object.keys(en).filter(k => !(k in pt));
const vazias = Object.entries({ ...pt, ...en }).filter(([, v]) => !v || !v.trim()).map(([k]) => k);
console.log(`chaves pt-BR: ${Object.keys(pt).length} | en: ${Object.keys(en).length}`);
console.log('faltando em en:', falta.length ? falta : 'nenhuma');
console.log('sobrando em en:', sobra.length ? sobra : 'nenhuma');
console.log('valores vazios:', vazias.length ? vazias : 'nenhum');
if (falta.length || sobra.length || vazias.length) process.exit(1);
