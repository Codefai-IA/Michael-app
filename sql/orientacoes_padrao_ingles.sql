CREATE OR REPLACE FUNCTION apply_default_guidelines()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supplements TEXT;
  v_video TEXT;
BEGIN
  IF NEW.role IS DISTINCT FROM 'client' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM patient_guidelines WHERE client_id = NEW.id) THEN
    RETURN NEW;
  END IF;
  SELECT default_recommended_supplements, default_free_meal_video_url
    INTO v_supplements, v_video
    FROM app_settings
    LIMIT 1;
  IF NEW.locale = 'en' THEN
    v_supplements := NULL;
  END IF;
  IF v_supplements IS NULL AND v_video IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO patient_guidelines (client_id, recommended_supplements, free_meal_video_url, video_urls)
  VALUES (NEW.id, v_supplements, v_video, '[]'::jsonb);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION remove_default_supplements_for_english()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.locale = 'en' AND OLD.locale IS DISTINCT FROM 'en' THEN
    UPDATE patient_guidelines
       SET recommended_supplements = NULL, updated_at = now()
     WHERE client_id = NEW.id
       AND recommended_supplements IS NOT NULL
       AND btrim(recommended_supplements) = (SELECT btrim(default_recommended_supplements) FROM app_settings LIMIT 1);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_remove_default_supplements_for_english ON profiles;
CREATE TRIGGER trg_remove_default_supplements_for_english
  AFTER UPDATE OF locale ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION remove_default_supplements_for_english();
