ALTER TABLE customers
  ADD COLUMN workflow_definition_id BIGINT
    REFERENCES workflow_definitions(id) ON DELETE SET NULL,
  ADD COLUMN rescreening_status VARCHAR(32) NOT NULL DEFAULT 'ok'
    CHECK (rescreening_status IN ('ok', 'needs_enrichment'));

CREATE INDEX idx_customers_workflow_definition_id ON customers(workflow_definition_id)
  WHERE workflow_definition_id IS NOT NULL;

CREATE INDEX idx_customers_rescreening_status ON customers(institution_id, rescreening_status)
  WHERE rescreening_status = 'needs_enrichment';
