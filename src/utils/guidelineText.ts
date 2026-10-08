/**
 * Le o texto livre das orientacoes (suplementos, manipulados) e devolve blocos para exibir com
 * visual de app. O admin continua escrevendo num textarea so; a estrutura vem de convencoes
 * simples do proprio texto:
 *
 *   WHEY PROTEIN: MARCAS APROVADAS       -> secao (linha toda em maiusculas; icone pelo assunto)
 *   DUX Nutrition                        -> grupo/card (linha seguida de itens ✅/❌)
 *   ✅ Whey Concentrado (WPC)            -> item aprovado (parenteses curtos viram etiqueta)
 *   ❌ Nutri Whey: não usar. Tem ...     -> item a evitar (depois do ":" vira o motivo)
 *   ⚠️ VitaPure: verificar disponibilidade -> item de atencao (idem)
 *   ⭐ Preferência: ...                  -> destaque (o rotulo antes do ":" fica em negrito)
 *   Obs.: ...                            -> nota
 *   Rótulo: a • b • c                    -> rotulo + etiquetas
 *   - item                               -> marcador
 *
 * Na tela nao aparece emoji nem travessao: os marcadores viram icones e o travessao vira virgula
 * (ou separa titulo/motivo, quando usado no lugar do ":"). Texto sem convencao vira paragrafo,
 * entao as orientacoes antigas (texto corrido, "- Creatina 5g") continuam aparecendo.
 */

export type GuidelineItem =
  | { type: 'approved'; text: string; tag?: string; detail?: string }
  | { type: 'avoid'; text: string; reason?: string }
  | { type: 'caution'; text: string; tag?: string; reason?: string }
  | { type: 'highlight'; label?: string; text: string }
  | { type: 'note'; text: string }
  | { type: 'chips'; label: string; chips: string[] }
  | { type: 'bullet'; text: string }
  | { type: 'text'; text: string };

export interface GuidelineGroup {
  type: 'group';
  title: string;
  items: GuidelineItem[];
}

/** Assunto da secao, para escolher o icone (whey, creatina, pre-treino...). */
export type GuidelineTopic =
  | 'protein'
  | 'creatine'
  | 'preworkout'
  | 'summary'
  | 'omega'
  | 'vitamin'
  | 'mineral'
  | 'collagen'
  | 'gainer'
  | 'sleep'
  | 'generic';

export interface GuidelineSection {
  topic?: GuidelineTopic;
  title?: string;
  subtitle?: string;
  blocks: Array<GuidelineItem | GuidelineGroup>;
}

// ©, ® e ™ tambem sao "pictographic" no Unicode, mas fazem parte do nome do produto (Creapure®).
const EMOJI = /(?![\u00A9\u00AE\u2122])\p{Extended_Pictographic}\u{FE0F}?/gu;
const APPROVED = /^\u{2705}\u{FE0F}?\s*/u; // ✅
const AVOID = /^\u{274C}\u{FE0F}?\s*/u; // ❌
const STAR = /^\u{2B50}\u{FE0F}?\s*/u; // ⭐
const CAUTION = /^\u{26A0}\u{FE0F}?\s*/u; // ⚠️
const NOTE = /^(obs\.?|observa[cç][aã]o)\s*:\s*/i;
const MAX_TAG_LENGTH = 20;

/** Texto que vai para a tela: sem emoji e sem travessao. */
function clean(text: string): string {
  return text
    .replace(EMOJI, '')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/,\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim();
}

function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

const TOPICS: Array<[GuidelineTopic, RegExp]> = [
  ['summary', /resumo|selecao|destaque|principais/],
  ['preworkout', /pre[\s-]?treino|cafeina|energia/],
  ['creatine', /creatina|creatine/],
  ['protein', /whey|proteina|protein|albumina/],
  ['omega', /omega/],
  ['vitamin', /vitamina|vitamin/],
  ['mineral', /magnesio|zinco|ferro|mineral/],
  ['collagen', /colageno/],
  ['gainer', /hipercalorico|massa|gainer/],
  ['sleep', /sono|melatonina/],
];

function topicOf(title: string): GuidelineTopic {
  const key = title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return TOPICS.find(([, re]) => re.test(key))?.[0] ?? 'generic';
}

function isHeading(line: string): boolean {
  const letters = line.replace(EMOJI, '').replace(/[^\p{L}]/gu, '');
  return letters.length >= 3 && letters === letters.toUpperCase() && letters !== letters.toLowerCase();
}

function isItemLine(line: string): boolean {
  return APPROVED.test(line) || AVOID.test(line) || CAUTION.test(line);
}

/** Separa "titulo — resto" / "titulo - resto" / "titulo: resto" (o que vier primeiro). */
function splitSep(text: string, allowColon = true): [string, string | undefined] {
  const re = allowColon ? /\s+[—–-]\s+|:\s+/ : /\s+[—–-]\s+/;
  const m = text.match(re);
  if (!m || m.index === undefined || m.index === 0) return [text, undefined];
  return [text.slice(0, m.index).trim(), text.slice(m.index + m[0].length).trim()];
}

function parseItem(line: string): GuidelineItem {
  if (APPROVED.test(line)) {
    const text = line.replace(APPROVED, '');
    const paren = text.match(/^(.*?)\s*\(([^()]*)\)$/);
    if (paren) {
      const [, name, inner] = paren;
      return inner.length <= MAX_TAG_LENGTH
        ? { type: 'approved', text: clean(name), tag: clean(inner) }
        : { type: 'approved', text: clean(name), detail: capitalize(clean(inner)) };
    }
    return { type: 'approved', text: clean(text) };
  }
  if (AVOID.test(line)) {
    const [text, reason] = splitSep(line.replace(AVOID, ''));
    return { type: 'avoid', text: clean(text), reason: reason ? capitalize(clean(reason)) : undefined };
  }
  if (CAUTION.test(line)) {
    const [text, reason] = splitSep(line.replace(CAUTION, ''));
    const paren = text.match(/^(.*?)\s*\(([^()]{1,20})\)$/);
    return {
      type: 'caution',
      text: clean(paren ? paren[1] : text),
      tag: paren ? clean(paren[2]) : undefined,
      reason: reason ? capitalize(clean(reason)) : undefined,
    };
  }
  if (STAR.test(line)) {
    const body = line.replace(STAR, '');
    const colon = body.indexOf(':');
    if (colon > 0 && colon <= 30) {
      return { type: 'highlight', label: clean(body.slice(0, colon)), text: clean(body.slice(colon + 1)) };
    }
    return { type: 'highlight', text: clean(body) };
  }
  if (NOTE.test(line)) {
    return { type: 'note', text: capitalize(clean(line.replace(NOTE, ''))) };
  }
  if (line.includes('•')) {
    const [label, rest] = splitSep(line);
    if (rest) {
      const chips = rest.split('•').map((c) => clean(c)).filter(Boolean);
      if (chips.length) return { type: 'chips', label: clean(label), chips };
    }
  }
  if (/^[-•*]\s+/.test(line)) {
    return { type: 'bullet', text: clean(line.replace(/^[-•*]\s+/, '')) };
  }
  // "Rótulo: produto" curto, sem frase (sem ponto): uma etiqueta so. Ex.: "Pré-treino: Performance Club"
  const colon = line.indexOf(': ');
  if (colon > 0 && colon <= 25) {
    const rest = line.slice(colon + 2).trim();
    if (rest && rest.length <= 60 && !rest.includes('.')) {
      return { type: 'chips', label: clean(line.slice(0, colon)), chips: [clean(rest)] };
    }
  }
  // "Marca — Produto" (com travessao/hifen, nao com ":") sem lista: uma etiqueta so
  const [label, product] = splitSep(line, false);
  if (product && label.length <= 40 && !/[.:]$/.test(label)) {
    return { type: 'chips', label: clean(label), chips: [clean(product)] };
  }
  return { type: 'text', text: clean(line) };
}

export function parseGuidelineText(raw: string): GuidelineSection[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n').map((l) => l.trim());
  const sections: GuidelineSection[] = [];
  let section: GuidelineSection = { blocks: [] };
  let group: GuidelineGroup | null = null;

  const nextNonEmpty = (from: number): string | undefined => {
    for (let j = from; j < lines.length; j++) if (lines[j]) return lines[j];
    return undefined;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line) {
      group = null; // linha em branco fecha o card da marca
      continue;
    }

    const next = nextNonEmpty(i + 1);
    // Linha seguida de itens ✅/❌ e card de marca, mesmo toda em maiusculas ("DUX").
    const startsGroup =
      !isItemLine(line) && !STAR.test(line) && next !== undefined && isItemLine(next) && line.length <= 60;

    if (isHeading(line) && !isItemLine(line) && !startsGroup) {
      if (section.blocks.length || section.title) sections.push(section);
      const plain = line.replace(EMOJI, '').trim();
      const [title, subtitle] = splitSep(plain);
      section = {
        topic: topicOf(plain),
        title: clean(title),
        subtitle: subtitle ? clean(subtitle) : undefined,
        blocks: [],
      };
      group = null;
      continue;
    }

    if (startsGroup) {
      group = { type: 'group', title: clean(line), items: [] };
      section.blocks.push(group);
      continue;
    }

    const item = parseItem(line);
    if (group) group.items.push(item);
    else section.blocks.push(item);
  }

  if (section.blocks.length || section.title) sections.push(section);
  return sections;
}
