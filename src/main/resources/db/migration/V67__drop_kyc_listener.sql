ALTER TABLE kyc_config
  DROP COLUMN IF EXISTS listener_url,
  DROP COLUMN IF EXISTS listener_api_key;
