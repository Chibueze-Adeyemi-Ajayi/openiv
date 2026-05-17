-- Set database timezone to Lagos (Africa/Lagos)
SET timezone = 'Africa/Lagos';

DO $$
BEGIN
  EXECUTE 'ALTER DATABASE ' || quote_ident(current_database()) || ' SET timezone = ''Africa/Lagos''';
END
$$;
