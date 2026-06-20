-- =============================================
-- Receitas (vídeos do YouTube Shorts + macros)
-- =============================================
-- Cada receita é um Short vertical com os macros já calculados daquela refeição.
-- O aluno pode adicionar uma receita como "refeição extra" do dia (soma macros).

CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  youtube_url TEXT NOT NULL,
  category TEXT,
  servings TEXT,                       -- porção / rendimento (ex: "1 porção", "2 panquecas")
  calories NUMERIC NOT NULL DEFAULT 0,
  protein NUMERIC NOT NULL DEFAULT 0,
  carbs NUMERIC NOT NULL DEFAULT 0,
  fat NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category);
CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON recipes(created_at DESC);

-- ---------------------------------------------
-- RLS: leitura para qualquer autenticado; escrita só para admin
-- ---------------------------------------------
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view recipes" ON recipes;
CREATE POLICY "Authenticated can view recipes"
  ON recipes FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert recipes" ON recipes;
CREATE POLICY "Admins can insert recipes"
  ON recipes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can update recipes" ON recipes;
CREATE POLICY "Admins can update recipes"
  ON recipes FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can delete recipes" ON recipes;
CREATE POLICY "Admins can delete recipes"
  ON recipes FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
