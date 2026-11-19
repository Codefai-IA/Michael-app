import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleHelp } from 'lucide-react';
import { Button } from '../ui/Button';
import { useI18n, type TKey } from '../../i18n';
import { placeTooltip, tourSeenKey, type Rect } from './placement';
import s from './tour.module.css';

/**
 * Tutorial interativo (copiado da Escola do Nutri, 18/11/2026): na primeira vez que o aluno abre a tela, um balao
 * destaca onde tocar, passo a passo. O botao "Como usar" repete.
 *
 * Diferenca da Escola: o "ja viu" e por PASSO. Aqui os alvos nem sempre existem (dia de treino sem tecnica,
 * refeicao sem opcao 2); se o tutorial inteiro ficasse marcado como visto, o aluno nunca veria esses passos.
 * Entao cada passo mostrado e gravado, e na proxima visita roda so o que falta e esta na tela.
 */
export interface TourStep {
  /** Valor do atributo data-tour do elemento destacado. */
  target: string;
  title: TKey;
  text: TKey;
}

const REPLAY_EVENT = 'michael-tour-replay';
const PAD = 6;
const START_DELAY_MS = 700;

function findTarget(target: string): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? el : null;
}

/** Outro popup aberto (dieta atualizada, aniversario, instalar app...): o tutorial espera. */
const otherModalOpen = () => !!document.querySelector('[aria-modal="true"]:not([data-tour-dialog])');

function readSeen(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}
function addSeen(key: string, targets: string[]) {
  try {
    const seen = readSeen(key);
    targets.forEach((tg) => seen.add(tg));
    localStorage.setItem(key, JSON.stringify([...seen]));
  } catch { /* sem storage: aparece de novo na proxima visita */ }
}

/** Botao "Como usar" do cabecalho: abre o tutorial da tela de novo. */
export function TourButton({ id }: { id: string }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className={s.replay}
      aria-label={t('tour.howToUse')}
      title={t('tour.howToUse')}
      onClick={() => window.dispatchEvent(new CustomEvent(REPLAY_EVENT, { detail: id }))}
    >
      <CircleHelp size={20} aria-hidden />
    </button>
  );
}

interface TourProps {
  id: string;
  steps: TourStep[];
  /** A tela terminou de carregar e os alvos estao no DOM. */
  ready: boolean;
  userId: string | null | undefined;
  /** Muda quando o conteudo da tela muda (dia do treino, refeicao aberta): tenta de novo os passos que faltam. */
  retryKey?: string | number | null;
  /** Tutorial que roda dentro de um popup: nao espera "outro popup" fechar. */
  insideModal?: boolean;
}

export function Tour({ id, steps, ready, userId, retryKey, insideModal = false }: TourProps) {
  const { t } = useI18n();
  const seenKey = tourSeenKey(id, userId);
  const [list, setList] = useState<TourStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [tipHeight, setTipHeight] = useState(200);
  const tipRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef(steps);
  useEffect(() => { stepsRef.current = steps; }, [steps]);

  /** onlyUnseen: primeira visita (so o que falta). Falso: botao "Como usar" (tudo que esta na tela). */
  const start = useCallback((onlyUnseen: boolean) => {
    const seen = onlyUnseen ? readSeen(seenKey) : new Set<string>();
    const visible = stepsRef.current.filter((st) => !seen.has(st.target) && findTarget(st.target));
    if (visible.length === 0) return;
    setIndex(0);
    setRect(null);
    setList(visible);
  }, [seenKey]);

  /** Fechar (Pular, Entendi, Esc): os passos desta rodada contam como vistos. */
  const finish = useCallback(() => {
    if (list) addSeen(seenKey, list.map((st) => st.target));
    setList(null);
  }, [list, seenKey]);

  // Primeira visita: comeca quando a tela carregou e nao ha outro popup aberto.
  useEffect(() => {
    if (!ready || !userId) return;
    let timer: ReturnType<typeof setTimeout>;
    const tryStart = () => {
      if (document.visibilityState === 'visible' && (insideModal || !otherModalOpen())) start(true);
      else timer = setTimeout(tryStart, 500);
    };
    timer = setTimeout(tryStart, START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [ready, userId, retryKey, insideModal, start]);

  useEffect(() => {
    const onReplay = (e: Event) => { if ((e as CustomEvent).detail === id) start(false); };
    window.addEventListener(REPLAY_EVENT, onReplay);
    return () => window.removeEventListener(REPLAY_EVENT, onReplay);
  }, [id, start]);

  // Tela saiu de "pronta" (popup da refeicao fechou): some sem marcar o resto; a proxima abertura recomeca.
  const step = ready ? list?.[index] ?? null : null;

  /** Anda para o passo seguinte (ou anterior) que ainda esta na tela; sem nenhum, fecha. */
  const go = useCallback((dir: 1 | -1) => {
    if (!list) return;
    let i = index + dir;
    while (i >= 0 && i < list.length && !findTarget(list[i].target)) i += dir;
    if (i >= list.length) finish();
    else if (i >= 0) setIndex(i);
  }, [list, index, finish]);

  // Rola ate o alvo e acompanha a posicao dele (rolagem suave, teclado, layout mudando).
  useEffect(() => {
    if (!step) return;
    const el = findTarget(step.target);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    let frame = 0;
    let last = '';
    const track = () => {
      const r = el.getBoundingClientRect();
      const key = `${r.top}|${r.left}|${r.width}|${r.height}`;
      if (key !== last) {
        last = key;
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      }
      frame = requestAnimationFrame(track);
    };
    track();
    return () => cancelAnimationFrame(frame);
  }, [step]);

  useLayoutEffect(() => {
    if (tipRef.current) setTipHeight(tipRef.current.offsetHeight);
  }, [step, rect?.width]);

  useEffect(() => {
    if (!step) return;
    tipRef.current?.querySelector<HTMLButtonElement>('[data-tour-next]')?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Esc fecha so o tutorial, nao o popup da refeicao por baixo.
      e.stopImmediatePropagation();
      finish();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [step, finish]);

  if (!list || !step) return null;

  const vp = { width: window.innerWidth, height: window.innerHeight };
  // Destaque nunca passa da tela (alvo maior que a tela fica recortado).
  const hole = rect
    ? {
        top: Math.max(rect.top - PAD, 8),
        left: Math.max(rect.left - PAD, 8),
        width: Math.min(rect.width + PAD * 2, vp.width - 16),
        height: Math.min(rect.height + PAD * 2, vp.height - 16, rect.top + rect.height + PAD - 8),
      }
    : null;
  const place = hole ? placeTooltip(hole, tipHeight, vp) : null;
  const isLast = index === list.length - 1;

  return createPortal(
    <div className={s.root}>
      <div className={s.blocker} onClick={(e) => e.stopPropagation()} aria-hidden />
      {hole ? (
        <div className={s.hole} style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }} aria-hidden />
      ) : null}
      <div
        ref={tipRef}
        className={s.tip}
        role="dialog"
        aria-modal="true"
        data-tour-dialog
        aria-labelledby="tour-title"
        aria-describedby="tour-text"
        style={place ? { top: place.top, left: place.left, width: place.width } : { visibility: 'hidden' }}
      >
        <span className={s.count}>{t('tour.step', { n: index + 1, total: list.length })}</span>
        <h2 id="tour-title" className={s.title}>{t(step.title)}</h2>
        <p id="tour-text" className={s.text}>{t(step.text)}</p>
        {list.length > 1 ? (
          <div className={s.dots} aria-hidden>
            {list.map((st, i) => <span key={st.target} className={i === index ? s.dotOn : s.dot} />)}
          </div>
        ) : null}
        <div className={s.actions}>
          <Button variant="ghost" size="sm" onClick={finish}>{t('tour.skip')}</Button>
          <div className={s.actionsRight}>
            {index > 0 ? <Button variant="outline" size="sm" onClick={() => go(-1)}>{t('tour.back')}</Button> : null}
            <Button size="sm" data-tour-next onClick={() => (isLast ? finish() : go(1))}>
              {isLast ? t('tour.done') : t('tour.next')}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
