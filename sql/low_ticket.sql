-- =============================================
-- FUNIL LOW TICKET (compra via webhook do gateway)
-- =============================================
-- Quem compra o produto low ticket ganha conta automaticamente (Edge Function
-- purchase-webhook) com um treino pronto, e enxerga so Home, Treino e Perfil.
--
-- Vale SO para alunos criados pelo webhook: o DEFAULT 'full' preenche todos os alunos
-- existentes e os criados pelo admin, sem UPDATE. Apenas o webhook grava 'low_ticket',
-- e ele nunca rebaixa um aluno que ja e 'full'.

-- 1. Nivel de acesso do aluno
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS access_tier TEXT NOT NULL DEFAULT 'full';

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_access_tier_chk;
ALTER TABLE profiles ADD CONSTRAINT profiles_access_tier_chk
  CHECK (access_tier IN ('full', 'low_ticket'));

-- O aluno pode editar o proprio profile (peso, metas...). Esta trava impede que ele mesmo
-- troque o access_tier pela API: so admin, o webhook (service_role, sem auth.uid()) ou o
-- SQL Editor (tambem sem auth.uid()) mudam o nivel.
CREATE OR REPLACE FUNCTION protect_access_tier() RETURNS trigger AS $$
BEGIN
  IF NEW.access_tier IS DISTINCT FROM OLD.access_tier
     AND auth.uid() IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  THEN
    NEW.access_tier := OLD.access_tier;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_access_tier ON profiles;
CREATE TRIGGER trg_protect_access_tier
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_access_tier();

-- 2. Produto do gateway -> template de treino que o comprador recebe
CREATE TABLE IF NOT EXISTS purchase_products (
  gateway_product_id  TEXT PRIMARY KEY,
  name                TEXT,
  access_tier         TEXT NOT NULL DEFAULT 'low_ticket' CHECK (access_tier IN ('low_ticket')),
  workout_template_id UUID REFERENCES workout_templates(id) ON DELETE SET NULL,
  active              BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Log de cada evento recebido. transaction_id UNIQUE = idempotencia: o gateway pode
--    reenviar o mesmo webhook e o aluno/treino nao duplica.
CREATE TABLE IF NOT EXISTS purchases (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway        TEXT,
  transaction_id TEXT NOT NULL,
  event          TEXT NOT NULL,
  email          TEXT,
  product_id     TEXT,
  client_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'processed' CHECK (status IN ('processed', 'ignored', 'error')),
  error          TEXT,
  payload        JSONB,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (transaction_id, event)
);

CREATE INDEX IF NOT EXISTS idx_purchases_email ON purchases(email);
CREATE INDEX IF NOT EXISTS idx_purchases_client_id ON purchases(client_id);

-- 4. Link do checkout do plano completo (botao do cadeado nas abas bloqueadas)
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS upgrade_url TEXT;

-- 5. RLS: so admin le/edita. O webhook usa service_role e passa por cima do RLS.
ALTER TABLE purchase_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage purchase products" ON purchase_products;
CREATE POLICY "Admins can manage purchase products" ON purchase_products
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can read purchases" ON purchases;
CREATE POLICY "Admins can read purchases" ON purchases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Verificacao: deve retornar 'full' com o total de alunos e nenhuma linha 'low_ticket'
SELECT access_tier, COUNT(*) FROM profiles GROUP BY access_tier;
