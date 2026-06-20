-- =============================================
-- SEED de teste: cria 1 treino (7 dias) + 1 dieta (4 refeições)
-- para a conta indicada pelo e-mail abaixo.
-- Seguro para rodar de novo: remove antes os planos de teste com o mesmo nome.
-- =============================================

DO $$
DECLARE
  v_email   TEXT := 'contaclaude5@gmail.com';  -- <<< troque aqui se sua conta de teste for outra
  v_client  UUID;
  v_plan    UUID;
  v_dw      UUID;
  v_diet    UUID;
  v_meal    UUID;
  d         INT;
  v_type    TEXT;
BEGIN
  -- 1. Resolver o cliente pelo e-mail
  SELECT id INTO v_client FROM profiles WHERE lower(email) = lower(v_email) LIMIT 1;
  IF v_client IS NULL THEN
    RAISE EXCEPTION 'Nenhum profile encontrado para o e-mail %', v_email;
  END IF;

  -- 2. Limpar dados de teste anteriores (idempotente)
  DELETE FROM workout_plans WHERE client_id = v_client;
  DELETE FROM diet_plans   WHERE client_id = v_client AND name = 'Dieta Teste';

  -- ----------------------------------------
  -- 3. TREINO: um daily_workout por dia da semana
  -- ----------------------------------------
  INSERT INTO workout_plans (client_id) VALUES (v_client) RETURNING id INTO v_plan;

  FOR d IN 0..6 LOOP
    v_type := CASE d
      WHEN 0 THEN 'Corrida'
      WHEN 1 THEN 'Musculação'
      WHEN 2 THEN 'Bike'
      WHEN 3 THEN 'Musculação'
      WHEN 4 THEN 'Corrida'
      WHEN 5 THEN 'Musculação'
      ELSE 'Bike'
    END;

    INSERT INTO daily_workouts (workout_plan_id, day_of_week, workout_type)
    VALUES (v_plan, d, v_type)
    RETURNING id INTO v_dw;

    INSERT INTO exercises (daily_workout_id, name, sets, reps, rest, order_index) VALUES
      (v_dw, 'Agachamento livre', 4, '12',  '1min30s', 0),
      (v_dw, 'Supino reto',       4, '10',  '1min30s', 1),
      (v_dw, 'Remada curvada',    3, '12',  '1min',    2);
  END LOOP;

  -- ----------------------------------------
  -- 4. DIETA: 4 refeições com alimentos
  -- ----------------------------------------
  INSERT INTO diet_plans
    (client_id, name, display_order, daily_calories, protein_g, carbs_g, fat_g, water_goal_liters, notes)
  VALUES
    (v_client, 'Dieta Teste', 0, 2200, 160, 220, 70, 3, 'Dieta gerada para teste')
  RETURNING id INTO v_diet;

  -- Café da manhã
  INSERT INTO meals (diet_plan_id, name, suggested_time, order_index)
  VALUES (v_diet, 'Café da manhã', '08:00', 0) RETURNING id INTO v_meal;
  INSERT INTO meal_foods (meal_id, food_name, quantity, quantity_units, unit_type, order_index) VALUES
    (v_meal, 'Ovo',        '2',   2,   'unidade', 0),
    (v_meal, 'Pão integral','50', 2,   'fatia',   1),
    (v_meal, 'Banana',     '1',   1,   'unidade', 2);

  -- Almoço
  INSERT INTO meals (diet_plan_id, name, suggested_time, order_index)
  VALUES (v_diet, 'Almoço', '12:30', 1) RETURNING id INTO v_meal;
  INSERT INTO meal_foods (meal_id, food_name, quantity, quantity_units, unit_type, order_index) VALUES
    (v_meal, 'Arroz',          '150', NULL, 'gramas', 0),
    (v_meal, 'Frango grelhado','150', NULL, 'gramas', 1),
    (v_meal, 'Feijão',         '100', NULL, 'gramas', 2);

  -- Lanche da tarde
  INSERT INTO meals (diet_plan_id, name, suggested_time, order_index)
  VALUES (v_diet, 'Lanche da tarde', '16:00', 2) RETURNING id INTO v_meal;
  INSERT INTO meal_foods (meal_id, food_name, quantity, quantity_units, unit_type, order_index) VALUES
    (v_meal, 'Whey protein', '30', NULL, 'gramas', 0),
    (v_meal, 'Aveia',        '40', NULL, 'gramas', 1);

  -- Jantar
  INSERT INTO meals (diet_plan_id, name, suggested_time, order_index)
  VALUES (v_diet, 'Jantar', '20:00', 3) RETURNING id INTO v_meal;
  INSERT INTO meal_foods (meal_id, food_name, quantity, quantity_units, unit_type, order_index) VALUES
    (v_meal, 'Batata doce', '200', NULL, 'gramas', 0),
    (v_meal, 'Carne magra', '150', NULL, 'gramas', 1),
    (v_meal, 'Salada',      '100', NULL, 'gramas', 2);

  RAISE NOTICE 'Seed concluído para % (client_id=%)', v_email, v_client;
END $$;
