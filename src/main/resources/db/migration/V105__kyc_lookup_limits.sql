-- Correct KYC lookup caps: Starter 1k, Growth 5k, Enterprise unlimited
UPDATE subscription_plans SET max_monthly_kyc_lookups = 1000 WHERE slug = 'starter';
UPDATE subscription_plans SET max_monthly_kyc_lookups = 5000 WHERE slug = 'growth';
UPDATE subscription_plans SET max_monthly_kyc_lookups = -1   WHERE slug = 'enterprise';
