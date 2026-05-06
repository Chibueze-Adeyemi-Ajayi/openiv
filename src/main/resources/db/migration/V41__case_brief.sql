-- Add brief summary field to cases
ALTER TABLE cases
    ADD COLUMN brief TEXT;

-- Populate brief from existing title for backward compatibility
UPDATE cases SET brief = title WHERE brief IS NULL;

-- Make brief NOT NULL going forward
ALTER TABLE cases
    ALTER COLUMN brief SET NOT NULL;
