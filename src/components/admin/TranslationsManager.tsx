import { useCallback, useMemo, useState } from 'react';
import { Check, Search, X, Languages, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { usePageData } from '../../hooks';
import { useAuth } from '../../contexts/AuthContext';
import styles from './TranslationsManager.module.css';

interface TranslationRow {
  id: string;
  entity_type: string;
  source_key: string;
  source_sample: string;
  locale: string;
  translated_text: string;
  status: 'pending' | 'approved' | 'rejected';
  origin: 'llm' | 'human';
}

const ENTITY_LABELS: Record<string, string> = {
  food: 'Alimentos',
  exercise: 'Exercícios',
  muscle_group: 'Grupos musculares',
  meal: 'Refeições',
  workout_type: 'Tipos de treino',
  recipe: 'Receitas',
  notice: 'Avisos',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendentes',
  approved: 'Aprovadas',
  rejected: 'Rejeitadas',
};

const PAGE_SIZE = 100;

/**
 * Revisao das traducoes de conteudo geradas pelo script.
 *
 * O aluno so ve o que estiver 'approved' (garantido pela RLS, nao so por esta tela), entao
 * enquanto o treinador nao revisar, o app mostra o nome original em portugues.
 */
export function TranslationsManager() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<TranslationRow[]>([]);
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [search, setSearch] = useState('');
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('content_translations')
      .select('*')
      .order('entity_type', { ascending: true })
      .order('source_sample', { ascending: true })
      .limit(5000);

    if (err) {
      // Mensagem crua ajuda quando a tabela ainda nao foi criada no banco.
      setError(`Erro ao carregar traduções: ${err.message}`);
      return;
    }
    setError(null);
    setRows((data ?? []) as TranslationRow[]);
  }, []);

  const { isInitialLoading: loading } = usePageData({
    userId: profile?.id,
    fetchData: loadRows,
  });

  const pendingByEntity = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of rows) {
      if (r.status === 'pending') counts[r.entity_type] = (counts[r.entity_type] ?? 0) + 1;
    }
    return counts;
  }, [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (entityFilter !== 'all' && r.entity_type !== entityFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (term && !r.source_sample.toLowerCase().includes(term) && !r.translated_text.toLowerCase().includes(term)) {
        return false;
      }
      return true;
    });
  }, [rows, entityFilter, statusFilter, search]);

  const visible = filtered.slice(0, PAGE_SIZE);

  async function persist(row: TranslationRow, status: TranslationRow['status']) {
    const text = (edited[row.id] ?? row.translated_text).trim();
    if (!text) {
      setError('A tradução não pode ficar vazia.');
      return;
    }

    setSavingId(row.id);
    try {
      const { error: err } = await supabase
        .from('content_translations')
        .update({
          translated_text: text,
          status,
          // Editou na mão -> deixa de ser saida crua do modelo.
          origin: text === row.translated_text ? row.origin : 'human',
          updated_at: new Date().toISOString(),
          updated_by: profile?.id ?? null,
        })
        .eq('id', row.id);

      if (err) {
        setError(`Erro ao salvar: ${err.message}`);
        return;
      }

      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? { ...r, translated_text: text, status, origin: text === r.translated_text ? r.origin : 'human' }
            : r
        )
      );
      setEdited((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      setError(null);
    } finally {
      setSavingId(null);
    }
  }

  async function approveVisible() {
    const toApprove = visible.filter((r) => r.status !== 'approved');
    for (const row of toApprove) {
      await persist(row, 'approved');
    }
  }

  const totalPending = Object.values(pendingByEntity).reduce((a, b) => a + b, 0);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <Languages size={20} /> Traduções (inglês)
        </h2>
        <p className={styles.subtitle}>
          O aluno só vê o que estiver aprovado. Enquanto não aprovar, o app mostra o nome
          original em português.
        </p>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar termo..."
          />
        </div>

        <select
          className={styles.select}
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
        >
          <option value="all">Todas as categorias</option>
          {Object.entries(ENTITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
              {pendingByEntity[value] ? ` (${pendingByEntity[value]} pendentes)` : ''}
            </option>
          ))}
        </select>

        <select
          className={styles.select}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <button className={styles.refreshBtn} onClick={loadRows} title="Recarregar">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className={styles.summary}>
        <span>
          {filtered.length} resultado(s)
          {filtered.length > PAGE_SIZE && ` — mostrando os primeiros ${PAGE_SIZE}`}
        </span>
        <span className={styles.pendingBadge}>{totalPending} pendentes no total</span>
        {visible.some((r) => r.status !== 'approved') && (
          <button className={styles.approveAllBtn} onClick={approveVisible}>
            <Check size={14} /> Aprovar os {visible.filter((r) => r.status !== 'approved').length} visíveis
          </button>
        )}
      </div>

      {loading ? (
        <div className={styles.empty}>Carregando...</div>
      ) : visible.length === 0 ? (
        <div className={styles.empty}>
          Nenhuma tradução encontrada. Rode <code>node scripts/translate-content.mjs</code> para gerar.
        </div>
      ) : (
        <div className={styles.list}>
          {visible.map((row) => (
            <div key={row.id} className={`${styles.row} ${styles[row.status]}`}>
              <div className={styles.rowMeta}>
                <span className={styles.entityTag}>{ENTITY_LABELS[row.entity_type] ?? row.entity_type}</span>
                {row.origin === 'human' && <span className={styles.humanTag}>editado</span>}
                <span className={styles.statusTag}>{STATUS_LABELS[row.status]}</span>
              </div>

              <div className={styles.rowContent}>
                <span className={styles.source} title={row.source_sample}>{row.source_sample}</span>
                <span className={styles.arrow}>→</span>
                <input
                  className={styles.input}
                  value={edited[row.id] ?? row.translated_text}
                  onChange={(e) => setEdited((prev) => ({ ...prev, [row.id]: e.target.value }))}
                />
              </div>

              <div className={styles.rowActions}>
                <button
                  className={styles.approveBtn}
                  disabled={savingId === row.id}
                  onClick={() => persist(row, 'approved')}
                  title="Aprovar"
                >
                  <Check size={16} />
                </button>
                <button
                  className={styles.rejectBtn}
                  disabled={savingId === row.id}
                  onClick={() => persist(row, 'rejected')}
                  title="Rejeitar"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
