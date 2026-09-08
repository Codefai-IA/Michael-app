-- =============================================
-- Traducoes do conteudo vindo do banco
-- =============================================
-- Nomes de alimento, exercicio, refeicao e tipo de treino sao TEXTO LIVRE copiado no momento
-- em que o treinador monta o plano (FoodSelect/ExerciseSelect copiam o nome, nao o id) — nao
-- existe FK para os catalogos. Por isso a traducao e resolvida por TEXTO NORMALIZADO, e nao
-- por coluna *_en nos catalogos: uma coluna so serviria para planos montados depois, deixando
-- de fora as 4.391 linhas de meal_foods e 5.419 de exercises que ja estao em producao.
--
-- Volume real: apesar daquelas milhares de linhas, existem so ~119 alimentos e ~157
-- exercicios DISTINTOS. ~350 linhas aqui cobrem o conteudo de todos os alunos.
--
-- source_key e gravado ja normalizado pelo mesmo codigo JS que o app usa
-- (src/utils/normalizeKey.ts). Nao dependemos de unaccent do Postgres justamente para nao
-- correr o risco de a normalizacao do banco divergir da do app — divergencia ali viraria
-- "traducao nao encontrada" silenciosa.

CREATE TABLE IF NOT EXISTS content_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,        -- food | exercise | meal | workout_type | muscle_group | recipe | notice
  source_key TEXT NOT NULL,         -- texto normalizado (lower, sem acento, sem virgula, espacos colapsados)
  source_sample TEXT NOT NULL,      -- texto original, para o admin reconhecer na tela de revisao
  locale TEXT NOT NULL,
  translated_text TEXT NOT NULL CHECK (length(btrim(translated_text)) > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  origin TEXT NOT NULL DEFAULT 'llm' CHECK (origin IN ('llm', 'human')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES profiles(id),
  CONSTRAINT content_translations_uniq UNIQUE (entity_type, source_key, locale)
);

-- O UNIQUE ja atende o lookup; este indice serve a tela de revisao (filtrar pendentes).
CREATE INDEX IF NOT EXISTS idx_ct_locale_status ON content_translations(locale, status);

-- ---------------------------------------------
-- RLS: aluno le so o que foi APROVADO; admin le tudo e escreve.
-- ---------------------------------------------
ALTER TABLE content_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read approved translations" ON content_translations;
CREATE POLICY "Authenticated read approved translations"
  ON content_translations FOR SELECT
  TO authenticated
  USING (status = 'approved');

DROP POLICY IF EXISTS "Admins read all translations" ON content_translations;
CREATE POLICY "Admins read all translations"
  ON content_translations FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins insert translations" ON content_translations;
CREATE POLICY "Admins insert translations"
  ON content_translations FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins update translations" ON content_translations;
CREATE POLICY "Admins update translations"
  ON content_translations FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins delete translations" ON content_translations;
CREATE POLICY "Admins delete translations"
  ON content_translations FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
