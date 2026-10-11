-- Repair only the currently applied proof whose potential grade was copied
-- into the profile. Do not re-score attempts, overwrite a newer proof,
-- change the category cooldown or turn an unsuccessful target into a pass.
UPDATE accounts AS a
SET data = jsonb_set(a.data, '{profile}',
    (a.data->'profile') || jsonb_build_object(
      'grade', proof.data#>'{finalRoleResult,confirmedGrade}',
      'categoryCorrection', jsonb_build_object(
        'rule', 'confirmed-target-profile-v1',
        'attemptId', proof.id,
        'previousGrade', a.data#>'{profile,grade}',
        'confirmedGrade', proof.data#>'{finalRoleResult,confirmedGrade}'
      )
    ))
FROM records AS proof
WHERE proof.kind = 'assessment'
  AND proof.owner = a.id
  AND proof.id = a.data#>>'{profile,verificationAttemptId}'
  AND a.data#>>'{profile,verified}' = 'true'
  AND proof.data->>'status' = 'finished'
  AND proof.data->>'targetKind' = 'role'
  AND proof.data->>'roleOutcomeRule' = 'target-grade-five-outcomes-evidence-v3'
  AND proof.data#>>'{finalRoleResult,completed}' = 'true'
  AND proof.data#>>'{finalRoleResult,applied}' = 'true'
  AND proof.data#>>'{finalRoleResult,status}' LIKE 'confirmed%'
  AND proof.data#>>'{finalRoleResult,confirmedGrade}' IN ('Junior', 'Middle', 'Senior')
  AND proof.data#>>'{finalRoleResult,confirmedGrade}' = proof.data->>'targetGrade'
  AND a.data#>>'{profile,grade}' = proof.data#>>'{finalRoleResult,level}'
  AND a.data#>>'{profile,grade}' <> proof.data#>>'{finalRoleResult,confirmedGrade}';
