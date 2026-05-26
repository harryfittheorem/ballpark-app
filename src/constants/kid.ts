export const AGE_GROUPS = ['8U', '10U', '12U', '14U', 'HS', 'College'] as const;

export type AgeGroup = (typeof AGE_GROUPS)[number];
