import { describe, expect, it } from 'vitest';
import { MAX_LENGTH, validateTitle } from './conventional-commit.ts';

describe('validateTitle', () => {
  it.each([
    'feat: add popup',
    'fix(sync): handle empty Harvest day',
    'chore(scripts): drop signed-commit rule',
    'ci: check PR titles',
    'refactor(popup)!: rename settings keys',
    'feat!: require Harvest account id',
    'build(deps): bump vitest to 5.0.5',
    'revert: feat: add popup',
  ])('accepts %s', (title) => {
    expect(validateTitle(title)).toEqual([]);
  });

  it.each([
    ['Set up repository foundation', /type\(scope\): subject/],
    ['feat:add popup', /type\(scope\): subject/],
    ['feat: ', /type\(scope\): subject/],
    ['feat:  add popup', /type\(scope\): subject/],
    ['Feat: add popup', /type\(scope\): subject/],
    ['feat(): add popup', /type\(scope\): subject/],
    ['feat(pop up): add popup', /type\(scope\): subject/],
    ['feature: add popup', /type "feature"/],
    ['wip: add popup', /type "wip"/],
    ['fix: handle empty day.', /period/],
    ['fix: handle empty day ', /whitespace/],
    [`feat: ${'a'.repeat(MAX_LENGTH)}`, /at most/],
  ])('rejects %s', (title, message) => {
    const errors = validateTitle(title);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(message);
  });
});
