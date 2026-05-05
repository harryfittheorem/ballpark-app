export const AGE_GROUPS = ['9U', '10U', '11U', '12U', '13U', '14U', '15U+'] as const;

export type AgeGroup = (typeof AGE_GROUPS)[number];
