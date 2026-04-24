-- V10: Transition custom_roles to a composite primary key for better multi-tenant isolation.

ALTER TABLE custom_roles DROP CONSTRAINT custom_roles_pkey;
ALTER TABLE custom_roles ADD PRIMARY KEY (id, institution_id);
