import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getCachedLocale, getCachedUnitSystem } from './localeCache';
import { supabase } from '../lib/supabase';
import { normalizeKey } from '../utils/normalizeKey';
import type { Locale, UnitSystem } from '../types/database';
import { ptBR, type TKey } from './dict/pt-BR';

export type { TKey };

type Dict = Record<string, string>;

/** Categorias de conteudo vindo do banco que podem ser traduzidas. */
export type ContentEntity =
  | 'food'
  | 'exercise'
  | 'meal'
  | 'workout_type'
  | 'muscle_group'
  | 'recipe'
  | 'notice'
  | 'reps'
  | 'diet_plan';

interface I18nContextValue {
  locale: Locale;
  unitSystem: UnitSystem;
  /** Texto de UI. Cai no pt-BR se a chave nao existir no dicionario carregado. */
  t: (key: TKey, vars?: Record<string, string | number>) => string;
  /**
   * Texto de CONTEUDO vindo do banco (nome de alimento, exercicio, refeicao...).
   *
   * REGRA CRITICA: chamar SOMENTE no ponto de renderizacao, dentro do JSX. Nunca guardar o
   * retorno em estado, nem usar antes de um .find()/.get()/.set()/.insert(). O `food_name`
   * e o `exercises.name` sao usados como CHAVE de lookup (mapa de nutricao, substituicoes,
   * equivalencias) — traduzir antes disso zera os macros do aluno em silencio.
   *
   * Devolve o original quando nao ha traducao aprovada. Nunca devolve string vazia.
   */
  tc: (entity: ContentEntity, original: string | null | undefined) => string;
}

const CONTENT_CACHE_KEY = 'mc_content_i18n';
const CONTENT_TTL_MS = 60 * 60 * 1000; // 1h

interface ContentCache {
  at: number;
  locale: string;
  entries: Record<string, string>;
}

/** Chave do mapa em memoria: entidade + texto normalizado. */
function contentKey(entity: string, original: string): string {
  return `${entity}::${normalizeKey(original)}`;
}

function readContentCache(locale: string): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(CONTENT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ContentCache;
    if (parsed.locale !== locale) return null;
    return parsed.entries;
  } catch {
    return null;
  }
}

function writeContentCache(locale: string, entries: Record<string, string>): void {
  try {
    localStorage.setItem(
      CONTENT_CACHE_KEY,
      JSON.stringify({ at: Date.now(), locale, entries } satisfies ContentCache)
    );
  } catch {
    // localStorage cheio ou bloqueado: seguir sem cache
  }
}

function isContentCacheFresh(): boolean {
  try {
    const raw = localStorage.getItem(CONTENT_CACHE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as ContentCache;
    return Date.now() - parsed.at < CONTENT_TTL_MS;
  } catch {
    return false;
  }
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    name in vars ? String(vars[name]) : match
  );
}

function isLocale(value: string | null): value is Locale {
  return value === 'pt-BR' || value === 'en';
}

function isUnitSystem(value: string | null): value is UnitSystem {
  return value === 'metric' || value === 'imperial';
}

/**
 * Provider de idioma do app do ALUNO.
 *
 * Fica ABAIXO do AuthProvider e reage ao profile por useEffect — nunca dentro do callback de
 * onAuthStateChange, que roda sob o lock do navigator.locks do supabase-js (consultar o banco
 * ali dentro trava o app em "Carregando..." para sempre).
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const { profile, isAdmin } = useAuth();

  // Cache local: o primeiro paint acontece antes do profile chegar. Sem isso, um aluno em
  // ingles veria a tela piscar em portugues a cada refresh.
  //
  // E' tambem o que faz a TELA DE LOGIN sair no idioma certo, ja que ali ainda nao ha
  // profile. De proposito NAO usamos navigator.language como palpite: um aluno brasileiro
  // com o navegador em ingles passaria a ver o login em ingles, o que seria uma regressao
  // para os alunos atuais. O custo e que, no primeiro acesso de um aluno novo em ingles, o
  // login aparece em portugues uma unica vez — depois do primeiro login fica correto.
  const cachedLocale = getCachedLocale();
  const cachedUnits = getCachedUnitSystem();

  // O painel admin e sempre pt-BR/metrico. Como os overlays globais (BirthdayModal,
  // WeeklyReportModal, PlanUpdatedModal...) renderizam tambem sob sessao admin, esta regra e
  // o que torna impossivel traduzir tela de admin por acidente.
  const locale: Locale = isAdmin
    ? 'pt-BR'
    : (profile?.locale ?? (isLocale(cachedLocale) ? cachedLocale : 'pt-BR'));

  const unitSystem: UnitSystem = isAdmin
    ? 'metric'
    : (profile?.unit_system ?? (isUnitSystem(cachedUnits) ? cachedUnits : 'metric'));

  const [foreignDict, setForeignDict] = useState<Dict | null>(null);
  // Inicializacao sincrona: o primeiro render ja sai traduzido quando ha cache.
  const [contentDict, setContentDict] = useState<Dict | null>(() =>
    locale === 'pt-BR' ? null : readContentCache(locale)
  );

  useEffect(() => {
    if (locale === 'pt-BR') {
      setForeignDict(null);
      return;
    }
    let active = true;
    // Carregado sob demanda: os alunos em portugues nao pagam por este chunk.
    import('./dict/en')
      .then((mod) => {
        if (active) setForeignDict(mod.en);
      })
      .catch((err) => {
        // Falhou o chunk: segue em pt-BR em vez de quebrar a tela.
        console.error('[i18n] falha ao carregar dicionario', locale, err);
      });
    return () => {
      active = false;
    };
  }, [locale]);

  useEffect(() => {
    if (locale === 'pt-BR') {
      setContentDict(null);
      return;
    }

    const cached = readContentCache(locale);
    if (cached) setContentDict(cached);
    // Revalida no maximo 1x/hora: o catalogo muda raramente e o aluno abre o app varias
    // vezes por dia.
    if (cached && isContentCacheFresh()) return;

    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('content_translations')
          .select('entity_type,source_key,translated_text')
          .eq('locale', locale)
          .eq('status', 'approved');

        // Tabela ainda nao criada / RLS / rede: mantem o cache e segue em pt-BR.
        if (error || !data || !active) return;

        const entries: Dict = {};
        for (const row of data) {
          entries[`${row.entity_type}::${row.source_key}`] = row.translated_text;
        }
        setContentDict(entries);
        writeContentCache(locale, entries);
      } catch (err) {
        console.error('[i18n] falha ao carregar traducoes de conteudo', err);
      }
    })();

    return () => {
      active = false;
    };
  }, [locale]);

  // Ajuda leitor de tela e a heuristica de traducao do navegador.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => {
    const t = (key: TKey, vars?: Record<string, string | number>): string => {
      // Fallback sempre para o texto pt-BR — nunca string vazia.
      const template = foreignDict?.[key] ?? ptBR[key] ?? key;
      return interpolate(template, vars);
    };
    const tc = (entity: ContentEntity, original: string | null | undefined): string => {
      const text = original ?? '';
      // Caminho dos 267 alunos em portugues: sai antes de qualquer lookup, custo zero e
      // comportamento identico ao que era antes desta feature.
      if (locale === 'pt-BR' || !text) return text;
      return contentDict?.[contentKey(entity, text)] ?? text;
    };

    return { locale, unitSystem, t, tc };
  }, [locale, unitSystem, foreignDict, contentDict]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n precisa estar dentro de I18nProvider');
  }
  return context;
}
