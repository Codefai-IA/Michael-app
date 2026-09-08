-- =============================================
-- Idioma e sistema de unidades por aluno
-- =============================================
-- O nutricionista escolhe, ao criar o aluno, em que idioma o app aparece para ele
-- e em que unidades o peso/altura/carga sao exibidos.
--
-- Aditivo e seguro para os alunos existentes: DEFAULT + NOT NULL preenche as 267 linhas
-- ja gravadas com pt-BR/metric, sem precisar de UPDATE e sem janela de inconsistencia.
--
-- IMPORTANTE: unit_system afeta APENAS exibicao e parse de input. Peso, altura e carga
-- continuam SEMPRE gravados em kg/cm no banco, nos dois sistemas.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'pt-BR';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unit_system TEXT NOT NULL DEFAULT 'metric';

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_locale_chk;
ALTER TABLE profiles ADD CONSTRAINT profiles_locale_chk
  CHECK (locale IN ('pt-BR', 'en'));

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_unit_system_chk;
ALTER TABLE profiles ADD CONSTRAINT profiles_unit_system_chk
  CHECK (unit_system IN ('metric', 'imperial'));
