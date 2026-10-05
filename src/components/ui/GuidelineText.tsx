import { useMemo } from 'react';
import {
  Check, X, Star, Info, AlertTriangle, Milk, FlaskConical, Zap, Award, Fish, Sun, Atom, Sparkles, Dumbbell, Moon, Pill,
  type LucideIcon,
} from 'lucide-react';
import {
  parseGuidelineText,
  type GuidelineItem,
  type GuidelineGroup,
  type GuidelineTopic,
} from '../../utils/guidelineText';
import styles from './GuidelineText.module.css';

/**
 * Exibe o texto livre das orientacoes (suplementos, manipulados) com visual de app: secoes,
 * cards por marca, itens aprovados/evitar, destaques e etiquetas. As convencoes do texto estao em
 * utils/guidelineText.ts. Texto sem convencao aparece como paragrafo, como antes.
 */
const TOPIC_ICONS: Record<GuidelineTopic, LucideIcon> = {
  protein: Milk,
  creatine: FlaskConical,
  preworkout: Zap,
  summary: Award,
  omega: Fish,
  vitamin: Sun,
  mineral: Atom,
  collagen: Sparkles,
  gainer: Dumbbell,
  sleep: Moon,
  generic: Pill,
};

export function GuidelineText({ text }: { text: string }) {
  const sections = useMemo(() => parseGuidelineText(text), [text]);

  return (
    <div className={styles.root}>
      {sections.map((section, sIdx) => (
        <section key={sIdx} className={styles.section}>
          {section.title && (
            <header className={styles.sectionHeader}>
              <SectionIcon topic={section.topic ?? 'generic'} />
              <div>
                <h3 className={styles.sectionTitle}>{section.title}</h3>
                {section.subtitle && <p className={styles.sectionSubtitle}>{section.subtitle}</p>}
              </div>
            </header>
          )}
          <div className={styles.blocks}>
            {mergeChipRows(section.blocks).map((block, bIdx) =>
              block.type === 'group' ? (
                <GroupCard key={bIdx} group={block} />
              ) : block.type === 'chipRows' ? (
                <div key={bIdx} className={styles.chipRows}>
                  {block.rows.map((row, rIdx) => (
                    <ChipsRow key={rIdx} label={row.label} chips={row.chips} />
                  ))}
                </div>
              ) : (
                <Item key={bIdx} item={block} />
              )
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function SectionIcon({ topic }: { topic: GuidelineTopic }) {
  const Icon = TOPIC_ICONS[topic];
  return (
    <span className={`${styles.sectionIcon} ${styles[`topic_${topic}`] ?? ''}`} aria-hidden>
      <Icon size={20} strokeWidth={2.2} />
    </span>
  );
}

type ChipsItem = Extract<GuidelineItem, { type: 'chips' }>;
type Block = GuidelineItem | GuidelineGroup | { type: 'chipRows'; rows: ChipsItem[] };

/** Linhas seguidas de "Marca — produtos" viram um card so, com divisorias (lista mais compacta). */
function mergeChipRows(blocks: Array<GuidelineItem | GuidelineGroup>): Block[] {
  const out: Block[] = [];
  for (const block of blocks) {
    const last = out[out.length - 1];
    if (block.type === 'chips' && last?.type === 'chipRows') last.rows.push(block);
    else if (block.type === 'chips') out.push({ type: 'chipRows', rows: [block] });
    else out.push(block);
  }
  return out;
}

function ChipsRow({ label, chips }: { label: string; chips: string[] }) {
  return (
    <div className={styles.chipsRow}>
      <span className={styles.chipsLabel}>{label}</span>
      <div className={styles.chips}>
        {chips.map((chip, idx) => (
          <span key={idx} className={styles.chip}>{chip}</span>
        ))}
      </div>
    </div>
  );
}

function GroupCard({ group }: { group: GuidelineGroup }) {
  return (
    <div className={styles.group}>
      <h4 className={styles.groupTitle}>{group.title}</h4>
      <div className={styles.groupItems}>
        {group.items.map((item, idx) => (
          <Item key={idx} item={item} />
        ))}
      </div>
    </div>
  );
}

function Item({ item }: { item: GuidelineItem }) {
  switch (item.type) {
    case 'approved':
      return (
        <div className={styles.row}>
          <span className={`${styles.rowIcon} ${styles.approvedIcon}`}><Check size={12} strokeWidth={3} /></span>
          <div className={styles.rowBody}>
            <span className={styles.rowText}>
              {item.text}
              {item.tag && <span className={styles.tag}>{item.tag}</span>}
            </span>
            {item.detail && <span className={styles.rowDetail}>{item.detail}</span>}
          </div>
        </div>
      );
    case 'avoid':
      return (
        <div className={styles.row}>
          <span className={`${styles.rowIcon} ${styles.avoidIcon}`}><X size={12} strokeWidth={3} /></span>
          <div className={styles.rowBody}>
            <span className={`${styles.rowText} ${styles.avoidText}`}>{item.text}</span>
            {item.reason && <span className={styles.rowDetail}>{item.reason}</span>}
          </div>
        </div>
      );
    case 'caution':
      return (
        <div className={styles.row}>
          <span className={`${styles.rowIcon} ${styles.cautionIcon}`}><AlertTriangle size={11} strokeWidth={2.6} /></span>
          <div className={styles.rowBody}>
            <span className={styles.rowText}>
              {item.text}
              {item.tag && <span className={styles.tag}>{item.tag}</span>}
            </span>
            {item.reason && <span className={`${styles.rowDetail} ${styles.cautionText}`}>{item.reason}</span>}
          </div>
        </div>
      );
    case 'highlight':
      return (
        <div className={styles.highlight}>
          <Star size={14} className={styles.highlightIcon} />
          <span>
            {item.label && <strong className={styles.highlightLabel}>{item.label}: </strong>}
            {item.text}
          </span>
        </div>
      );
    case 'note':
      return (
        <div className={styles.note}>
          <Info size={13} className={styles.noteIcon} />
          <span>{item.text}</span>
        </div>
      );
    case 'chips':
      // Dentro do card de uma marca: linha simples, sem moldura
      return <ChipsRow label={item.label} chips={item.chips} />;
    case 'bullet':
      return (
        <div className={styles.bullet}>
          <span className={styles.bulletDot} aria-hidden />
          <span>{item.text}</span>
        </div>
      );
    default:
      return <p className={styles.paragraph}>{item.text}</p>;
  }
}
