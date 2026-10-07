-- Enforce one active qualification attempt even across app processes.
CREATE UNIQUE INDEX IF NOT EXISTS records_one_active_assessment
 ON records(owner) WHERE kind='assessment' AND data->>'status'='active';
