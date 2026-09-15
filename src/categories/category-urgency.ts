export const CategoryUrgency = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
} as const;

export type CategoryUrgency = (typeof CategoryUrgency)[keyof typeof CategoryUrgency];

export const CATEGORY_URGENCY_VALUES = Object.values(CategoryUrgency);

export const CATEGORY_URGENCY_RANK: Record<CategoryUrgency, number> = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
};
