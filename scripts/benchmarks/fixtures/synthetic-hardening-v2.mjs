// Frozen before opening the fresh holdout. No product-scoring imports.
// The same authored ability model is reused with fresh seeds; this is not human validation.
import {GRADE_PERSONAS} from './synthetic-v1.mjs';
export const HARDENING_VERSION='synthetic-hardening-v2';
export const FRESH_SEED='2026-10-10:fresh-grades-v2:locked';
export const SAFETY_SEED='2026-10-10:grade-safety-v2:locked';
export const PERSONAS=structuredClone(GRADE_PERSONAS);
export const SAFETY_PERSONAS=[
 {id:'theory-only',grade:'BelowJunior',theory:[1,1,1],coding:[0,0,0]},
 {id:'coding-only',grade:'BelowJunior',theory:[0,0,0],coding:[1,1,1]},
 {id:'random-choice',grade:'BelowJunior',theory:[.25,.25,.25],coding:[0,0,0]},
 {id:'weak-practice',grade:'BelowJunior',theory:[.95,.9,.8],coding:[.08,.02,0]},
];
export const ACCEPTANCE={development:{middleRecallMin:.8,retestMin:.8,overgradingMax:.01},freshHoldout:{accuracyMin:.85,middleRecallMin:.8,retestMin:.8,overgradingMax:.01},safety:{theoryOnlyQualifiedMax:0,codingOnlyQualifiedMax:0,randomChoiceQualifiedMax:0}};
