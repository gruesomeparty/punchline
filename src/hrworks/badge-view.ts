// What the badge on an HRworks day row says. Only times and the action go into HRworks' page,
// never Harvest details, because HRworks' scripts can read whatever is added there.

import type { PlannedDay } from '../plan/plan.ts';
import { isWritable, oldTimes } from '../plan/write-runner.ts';

export type BadgeKind = 'create' | 'override' | 'flag' | 'match';

export type BadgeView = {
  kind: BadgeKind;
  /** The old times of an override, shown struck through before `text`. */
  old: string;
  text: string;
  /** Shown on hover. */
  title: string;
  writable: boolean;
};

/** The badge for a day, or null for days punchline has nothing to say about. */
export function badgeView(day: PlannedDay): BadgeView | null {
  const times = isWritable(day) ? `${day.times.start}–${day.times.end}` : '';
  // Legal limits stay in the hover text, so the badge still shows only times and the action.
  const warnings = day.harvest.status === 'times' ? (day.harvest.warnings ?? []) : [];
  const hint = warnings.length > 0 ? `. ⚠ ${warnings.join(', ')}` : '';
  switch (day.action) {
    case 'create':
      return {
        kind: 'create',
        old: '',
        text: `+ ${times}`,
        title: `Write this day${hint}`,
        writable: true,
      };
    case 'override':
      return {
        kind: 'override',
        old: isWritable(day) ? oldTimes(day) : '',
        text: times,
        title: `Override this day${hint}`,
        writable: true,
      };
    case 'flag':
    case 'check':
      return { kind: 'flag', old: '', text: '⚠ check', title: day.reason, writable: false };
    case 'skip':
      return { kind: 'match', old: '', text: '✓', title: 'Matches Harvest', writable: false };
    case 'none':
      return null;
  }
}
