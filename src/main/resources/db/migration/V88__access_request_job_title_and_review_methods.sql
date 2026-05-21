-- Add job title to access_requests so we know the requester's role/seniority
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS job_title TEXT;
