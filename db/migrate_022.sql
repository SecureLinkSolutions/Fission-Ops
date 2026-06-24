-- Extend org_api_keys service CHECK constraint to include 'anthropic'
ALTER TABLE org_api_keys DROP CONSTRAINT IF EXISTS org_api_keys_service_check;
ALTER TABLE org_api_keys ADD CONSTRAINT org_api_keys_service_check
  CHECK (service IN ('virustotal', 'abuseipdb', 'shodan', 'anthropic'));
