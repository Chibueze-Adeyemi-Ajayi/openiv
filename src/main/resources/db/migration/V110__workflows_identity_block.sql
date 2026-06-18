-- Merge bvn_verify and nin_verify into a single identity_verify block.
-- identity_verify uses whichever identifier (BVN/NIN) is present on the customer;
-- both are optional in the payload — the block accepts either or both.

UPDATE workflow_definitions
SET blocks = (
  jsonb_build_array(jsonb_build_object('type', 'identity_verify')) ||
  COALESCE(
    (SELECT jsonb_agg(b ORDER BY ordinality)
     FROM jsonb_array_elements(blocks) WITH ORDINALITY AS t(b, ordinality)
     WHERE b->>'type' NOT IN ('bvn_verify', 'nin_verify')),
    '[]'::jsonb
  )
)
WHERE blocks @> '[{"type":"bvn_verify"}]'::jsonb
   OR blocks @> '[{"type":"nin_verify"}]'::jsonb;
