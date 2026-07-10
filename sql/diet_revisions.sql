-- =============================================
-- Revisões de dieta (snapshot pré-salvamento)
-- =============================================
-- Sempre que o admin salva uma dieta, o estado ANTERIOR dela é guardado
-- aqui como JSON. O popup "Dieta atualizada" do aluno usa esse snapshot
-- para mostrar o que mudou (ex.: Arroz 100g → 150g) e o resumo de
-- macros antes/depois.
--
-- Formato do snapshot:
--   {
--     "plan":  { "name", "daily_calories", "protein_g", "carbs_g", "fat_g" },
--     "meals": [{ "id", "name", "order_index",
--                 "meal_foods": [{ "id", "food_name", "quantity",
--                                  "unit_type", "quantity_units", "order_index" }] }]
--   }

CREATE TABLE IF NOT EXISTS diet_plan_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diet_plan_id UUID NOT NULL REFERENCES diet_plans(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  -- Igual ao updated_at gravado no diet_plans no mesmo salvamento,
  -- para o popup filtrar por "revisões depois do que o aluno já viu".
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diet_plan_revisions_client_created
  ON diet_plan_revisions(client_id, created_at);

-- ---------------------------------------------
-- RLS
-- ---------------------------------------------
ALTER TABLE diet_plan_revisions ENABLE ROW LEVEL SECURITY;

-- Aluno lê os próprios snapshots (para montar o diff no popup)
DROP POLICY IF EXISTS "Clients view own diet revisions" ON diet_plan_revisions;
CREATE POLICY "Clients view own diet revisions"
  ON diet_plan_revisions FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

-- Admin gerencia tudo (insere no salvamento e limpa revisões antigas)
DROP POLICY IF EXISTS "Admins manage diet revisions" ON diet_plan_revisions;
CREATE POLICY "Admins manage diet revisions"
  ON diet_plan_revisions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
