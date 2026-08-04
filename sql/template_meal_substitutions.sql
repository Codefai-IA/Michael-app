-- =============================================
-- FIX: "Erro ao salvar template" (dieta)
-- =============================================
-- O admin (DietTemplatesManager) insere `meal_substitutions` em diet_template_meals,
-- mas a coluna nunca foi criada no banco -> PostgREST retorna PGRST204
-- ("Could not find the 'meal_substitutions' column ... in the schema cache")
-- e o modal trava em "Salvando...".
--
-- Espelha a coluna equivalente que ja existe em `meals` (jsonb, default array vazio).

ALTER TABLE diet_template_meals
ADD COLUMN IF NOT EXISTS meal_substitutions JSONB DEFAULT '[]'::jsonb;

-- Normaliza linhas antigas (ficariam NULL sem o default retroativo em versoes < PG 11)
UPDATE diet_template_meals
SET meal_substitutions = '[]'::jsonb
WHERE meal_substitutions IS NULL;

-- Verificacao: deve retornar 1 linha (jsonb)
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'diet_template_meals'
  AND column_name = 'meal_substitutions';
