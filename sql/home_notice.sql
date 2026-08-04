-- =============================================
-- QUADRO DE AVISOS DA TELA INICIAL
-- =============================================
-- Aviso global escrito pelo admin (ex: "Receita nova disponivel", "Feriado: sem
-- planejamento na sexta") exibido no topo da Home de todos os alunos.
-- Vive em app_settings (tabela de linha unica), igual ao premio do ranking.

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS home_notice_title  TEXT,
  ADD COLUMN IF NOT EXISTS home_notice_text   TEXT,
  ADD COLUMN IF NOT EXISTS home_notice_active BOOLEAN DEFAULT false;

-- Verificacao: deve retornar 3 linhas
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'app_settings'
  AND column_name LIKE 'home_notice%'
ORDER BY column_name;
