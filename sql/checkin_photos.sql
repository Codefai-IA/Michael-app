-- =============================================
-- Auditoria Social: Fotos de Check-in + Calendário
-- =============================================
-- Funcionalidade de transparência/antifraude:
--  - Foto obrigatória de refeição (dieta) e pós-treino
--  - Marca d'água de data/hora (taken_at) para auditoria
--  - Calendário mensal público (fiscalização mútua no ranking)

-- ---------------------------------------------
-- 1. Tabela de fotos de check-in
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS checkin_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,                       -- dia (fuso Brasília) ao qual a foto pertence
  type TEXT NOT NULL CHECK (type IN ('diet', 'workout')),
  storage_path TEXT NOT NULL,               -- caminho dentro do bucket checkin-photos
  taken_at TIMESTAMPTZ NOT NULL,            -- momento EXATO do clique (marca d'água/auditoria)
  meal_id UUID REFERENCES meals(id) ON DELETE SET NULL,  -- qual refeição (dieta), opcional
  activity_type TEXT,                       -- tipo de treino concluído: 'corrida','bike','musculacao'...
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cobre tanto buscas por dia quanto por intervalo de mês (date é ordenável).
CREATE INDEX IF NOT EXISTS idx_checkin_photos_client_date
  ON checkin_photos(client_id, date);

-- ---------------------------------------------
-- 2. RLS — leitura pública (fiscalização mútua), escrita só própria
-- ---------------------------------------------
ALTER TABLE checkin_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view all checkin photos" ON checkin_photos;
CREATE POLICY "Authenticated can view all checkin photos"
  ON checkin_photos FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users insert own checkin photos" ON checkin_photos;
CREATE POLICY "Users insert own checkin photos"
  ON checkin_photos FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own checkin photos" ON checkin_photos;
CREATE POLICY "Users delete own checkin photos"
  ON checkin_photos FOR DELETE
  TO authenticated
  USING (client_id = auth.uid());

-- ---------------------------------------------
-- 3. Bucket de Storage para as fotos
-- ---------------------------------------------
-- Bucket público para leitura (igual ao padrão atual de 'avatars').
INSERT INTO storage.buckets (id, name, public)
VALUES ('checkin-photos', 'checkin-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Policies de Storage: leitura pública, escrita/remoção só na pasta do próprio usuário.
-- Caminho usado pelo app: {client_id}/{date}/{type}-{timestamp}.jpg
DROP POLICY IF EXISTS "Public read checkin photos" ON storage.objects;
CREATE POLICY "Public read checkin photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'checkin-photos');

DROP POLICY IF EXISTS "Users upload own checkin photos" ON storage.objects;
CREATE POLICY "Users upload own checkin photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'checkin-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users delete own checkin photos storage" ON storage.objects;
CREATE POLICY "Users delete own checkin photos storage"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'checkin-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------
-- 4. RPC: calendário mensal (próprio OU de terceiros do ranking)
-- ---------------------------------------------
-- SECURITY DEFINER expõe apenas o necessário para a fiscalização social,
-- sem abrir a tabela daily_progress inteira para leitura de terceiros.
CREATE OR REPLACE FUNCTION get_user_calendar(p_client_id UUID, p_year_month TEXT)
RETURNS TABLE (
  date DATE,
  has_diet BOOLEAN,
  has_workout BOOLEAN,
  activity_types TEXT[],
  photos JSONB
) AS $$
  SELECT
    days.date,
    COALESCE(array_length(dp.meals_completed, 1) > 0, false)      AS has_diet,
    COALESCE(array_length(dp.exercises_completed, 1) > 0, false)  AS has_workout,
    COALESCE(
      array_agg(DISTINCT ph.activity_type)
        FILTER (WHERE ph.activity_type IS NOT NULL),
      '{}'
    ) AS activity_types,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', ph.id,
          'type', ph.type,
          'taken_at', ph.taken_at,
          'storage_path', ph.storage_path,
          'meal_id', ph.meal_id,
          'activity_type', ph.activity_type
        ) ORDER BY ph.taken_at
      ) FILTER (WHERE ph.id IS NOT NULL),
      '[]'::jsonb
    ) AS photos
  FROM (
    -- Une todos os dias que têm progresso OU foto no mês solicitado
    SELECT DISTINCT d AS date FROM (
      SELECT date AS d FROM daily_progress
        WHERE client_id = p_client_id AND to_char(date, 'YYYY-MM') = p_year_month
      UNION
      SELECT date AS d FROM checkin_photos
        WHERE client_id = p_client_id AND to_char(date, 'YYYY-MM') = p_year_month
    ) u
  ) days
  LEFT JOIN daily_progress dp
    ON dp.client_id = p_client_id AND dp.date = days.date
  LEFT JOIN checkin_photos ph
    ON ph.client_id = p_client_id AND ph.date = days.date
  GROUP BY days.date, dp.meals_completed, dp.exercises_completed
  ORDER BY days.date;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_user_calendar(UUID, TEXT) TO authenticated;

-- ---------------------------------------------
-- 5. Helper: existe foto de dieta no dia? (gate antifraude de pontos)
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION has_diet_photo(p_client_id UUID, p_date DATE)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM checkin_photos
    WHERE client_id = p_client_id AND date = p_date AND type = 'diet'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION has_diet_photo(UUID, DATE) TO authenticated;
