export const SupportStatus = {
  OPEN: 'OPEN',
  RESOLVED: 'RESOLVED',
} as const;

export type SupportStatus = (typeof SupportStatus)[keyof typeof SupportStatus];

export const SUPPORT_STATUS_VALUES = Object.values(SupportStatus);

export const SupportSenderType = {
  MEMBER: 'MEMBER',
  ADMIN: 'ADMIN',
} as const;

export type SupportSenderType = (typeof SupportSenderType)[keyof typeof SupportSenderType];
