ALTER TABLE behavioral_rules
  ADD COLUMN template_type    VARCHAR(50) NOT NULL DEFAULT '',
  ADD COLUMN policy_statement TEXT        NOT NULL DEFAULT '';

-- Backfill template_type for seeded default rules
UPDATE behavioral_rules SET template_type = 'ip_cluster'     WHERE rule_id = 'pat-1';
UPDATE behavioral_rules SET template_type = 'geo_impossible'  WHERE rule_id = 'pat-2';
UPDATE behavioral_rules SET template_type = 'device_shared'   WHERE rule_id = 'pat-3';
UPDATE behavioral_rules SET template_type = 'off_hours_burst' WHERE rule_id = 'pat-4';
UPDATE behavioral_rules SET template_type = 'velocity_ring'   WHERE rule_id = 'pat-5';
