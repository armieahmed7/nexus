// F04 wallet helpers for pages (re-exports the shared badge rules).
export { badgeCandidates, badgeView } from './badgeRules';
import { daysBetween } from '../../domain/rules';
export const daysUntil = (today: string, d: string) => daysBetween(today, String(d).slice(0, 10));
