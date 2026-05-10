-- Ensure every institution has a default aml_settings row.
-- Defaults come from column DEFAULTs set in V51 (45 / 45 / 85 for both transaction and behavioral).

-- 1. Backfill: create rows for any existing institutions that don't have one yet
INSERT INTO aml_settings (institution_id, auto_open_case)
SELECT i.id, false
FROM institutions i
LEFT JOIN aml_settings s ON s.institution_id = i.id
WHERE s.id IS NULL;

-- 2. Trigger: auto-create a default aml_settings row whenever a new institution is created
CREATE OR REPLACE FUNCTION create_default_aml_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO aml_settings (institution_id, auto_open_case)
  VALUES (NEW.id, false)
  ON CONFLICT (institution_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_default_aml_settings ON institutions;

CREATE TRIGGER trg_create_default_aml_settings
AFTER INSERT ON institutions
FOR EACH ROW
EXECUTE FUNCTION create_default_aml_settings();
