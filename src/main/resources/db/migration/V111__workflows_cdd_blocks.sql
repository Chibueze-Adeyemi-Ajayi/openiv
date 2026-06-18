-- Rename phone_verify → phone_basic (more precise CDD block name).
-- phone_basic = carrier lookup; phone_fraud = fraud-signal check (new separate block).

UPDATE workflow_definitions
SET blocks = (
  SELECT jsonb_agg(
    CASE WHEN b->>'type' = 'phone_verify'
         THEN jsonb_set(b, '{type}', '"phone_basic"')
         ELSE b
    END
    ORDER BY ordinality
  )
  FROM jsonb_array_elements(blocks) WITH ORDINALITY AS t(b, ordinality)
)
WHERE blocks @> '[{"type":"phone_verify"}]'::jsonb;

-- Also rename the auto-seeded default workflow from KYC to CDD terminology.
UPDATE workflow_definitions
SET name = 'Default CDD Workflow'
WHERE name = 'Default KYC Re-screening';
