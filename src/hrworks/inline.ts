// Injected mode: punchline's badges on HRworks' own day rows, and a small punchline bar under
// the month picker. Everything sits in closed shadow roots, so HRworks' styles can't break it
// and it can't leak into HRworks. Only times and actions go into the page. Harvest is loaded by
// the background, so the token never reaches it.

import { summaryLine } from '../days/day-view.ts';
import { lastDayOfMonth } from '../lib/time.ts';
import { type PlannedDay, planDays } from '../plan/plan.ts';
import { loadWriteLog } from '../plan/write-log.ts';
import { holdUnchecked, isWritable, runWrites, type WritableDay } from '../plan/write-runner.ts';
import { confirmWrite } from '../ui/write-confirm.ts';
import { badgeView } from './badge-view.ts';
import { INLINE_STYLE } from './inline-style.ts';
import type { HarvestRowsResponse } from './messages.ts';
import {
  findRow,
  GUIDE,
  HrworksReadError,
  type ReadOptions,
  readHrworksDays,
  readSelectedMonth,
} from './page.ts';
import { writeDays } from './write.ts';

const BAR_TAG = 'punchline-bar';
const BADGE_TAG = 'punchline-badge';

export type InlineOptions = ReadOptions & {
  /** Asks the background for Harvest's rows. */
  loadRows: (from: string, to: string) => Promise<HarvestRowsResponse>;
  /** Runs `task` unless punchline is already busy in this tab. Resolves with whether it ran. */
  exclusive: (task: () => Promise<void>) => Promise<boolean>;
  /** Tests open the shadow roots to look inside. */
  shadowMode?: ShadowRootMode;
};

export type Inline = {
  /** Compares the month HRworks shows with Harvest and puts a badge on every day. */
  check: () => Promise<void>;
  unmount: () => void;
};

type Result = { text: string; kind: string };

function make<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  text = '',
  className = '',
): HTMLElementTagNameMap[K] {
  const element = doc.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

export function mountInline(doc: Document, options: InlineOptions): Inline {
  const planned = new Map<string, PlannedDay>();
  const results = new Map<string, Result>();
  let readAt = '';
  let busy = false;

  // The bar lives in its own host, re-inserted whenever HRworks re-renders the month picker.
  const barHost = doc.createElement(BAR_TAG);
  const mode = options.shadowMode ?? 'closed';
  const barRoot = barHost.attachShadow({ mode });
  // HRworks reacts to clicks on its rows and form, so ours stop at the host.
  barHost.addEventListener('click', (event) => event.stopPropagation());
  const style = make(doc, 'style');
  style.textContent = INLINE_STYLE;
  const bar = make(doc, 'div', '', 'bar');
  const mark = make(doc, 'span', 'p', 'mark');
  mark.setAttribute('aria-hidden', 'true');
  const checkButton = make(doc, 'button', 'Compare with Harvest', 'primary');
  checkButton.type = 'button';
  const summary = make(doc, 'span', '', 'summary');
  const writeAll = make(doc, 'button', '', 'secondary');
  writeAll.type = 'button';
  writeAll.hidden = true;
  const status = make(doc, 'span', '', 'status');
  status.setAttribute('role', 'status');
  bar.append(mark, make(doc, 'strong', 'punchline'), checkButton, summary, writeAll, status);
  barRoot.append(style, bar);

  function showStatus(text: string, kind = ''): void {
    status.textContent = text;
    status.className = `status ${kind}`;
  }

  function remaining(): WritableDay[] {
    return [...planned.values()].filter(
      (day): day is WritableDay => isWritable(day) && results.get(day.harvest.date)?.kind !== 'ok',
    );
  }

  function updateButtons(): void {
    const count = remaining().length;
    writeAll.textContent = `Write all ${count}`;
    writeAll.hidden = count < 2;
    checkButton.disabled = busy;
    writeAll.disabled = busy;
  }

  function badgeContent(day: PlannedDay): HTMLElement | null {
    const view = badgeView(day);
    if (!view) return null;
    const result = results.get(day.harvest.date);
    if (result) return make(doc, 'span', result.text, `badge result ${result.kind}`);
    const badge = make(doc, view.writable ? 'button' : 'span', '', `badge ${view.kind}`);
    badge.title = view.title;
    if (view.old) badge.append(make(doc, 's', view.old), doc.createTextNode(' → '));
    badge.append(doc.createTextNode(view.text));
    if (badge instanceof HTMLButtonElement) {
      badge.type = 'button';
      badge.disabled = busy;
      badge.addEventListener('click', () => void write([day as WritableDay]));
    }
    return badge;
  }

  /** Puts the bar and any missing badges back after HRworks re-rendered the page. */
  function attach(): void {
    const monthGroup = doc.querySelector(`[data-guide-id="${GUIDE.monthGroup}"]`);
    const anchor = monthGroup?.parentElement;
    if (anchor && !barHost.isConnected) anchor.after(barHost);
    for (const [date, day] of planned) {
      const row = findRow(doc, date);
      if (!row || row.querySelector(BADGE_TAG)) continue;
      const content = badgeContent(day);
      if (!content) continue;
      const host = doc.createElement(BADGE_TAG);
      host.dataset.date = date;
      const root = host.attachShadow({ mode });
      host.addEventListener('click', (event) => event.stopPropagation());
      const badgeStyle = make(doc, 'style');
      badgeStyle.textContent = INLINE_STYLE;
      root.append(badgeStyle, content);
      (row.querySelector('.col-10 .row') ?? row).append(host);
    }
  }

  /** Replaces every badge, after the plan or a result changed. */
  function refreshBadges(): void {
    for (const host of doc.querySelectorAll(BADGE_TAG)) host.remove();
    attach();
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      attach();
    }, 50);
  });
  observer.observe(doc.body, { childList: true, subtree: true });
  attach();

  async function check(): Promise<void> {
    await options.exclusive(async () => {
      const shown = readSelectedMonth(doc);
      if (!shown) {
        showStatus('Open Zeitwirtschaft → Arbeitszeiten first.', 'error');
        return;
      }
      const month = `${shown.year}-${String(shown.month).padStart(2, '0')}`;
      const from = `${month}-01`;
      const to = lastDayOfMonth(from);
      busy = true;
      updateButtons();
      try {
        showStatus('Loading Harvest…');
        const harvest = await options.loadRows(from, to);
        if (!harvest.ok) {
          showStatus(harvest.error, 'error');
          return;
        }
        showStatus('Reading HRworks…');
        readAt = new Date().toISOString();
        const first = harvest.rows[0]?.date ?? from;
        const last = harvest.rows.at(-1)?.date ?? to;
        const hrworks = await readHrworksDays(doc, first, last, options);
        const plan = planDays(harvest.rows, hrworks, {
          mode: harvest.mode,
          weekendHours: harvest.weekendHours,
        });
        planned.clear();
        results.clear();
        for (const day of plan) planned.set(day.harvest.date, day);
        summary.textContent = summaryLine(plan);
        showStatus('');
      } catch (error) {
        showStatus(
          error instanceof HrworksReadError ? error.message : 'Unexpected error reading HRworks.',
          'error',
        );
      } finally {
        busy = false;
        refreshBadges();
        updateButtons();
      }
    });
  }

  async function write(candidates: readonly WritableDay[]): Promise<void> {
    if (busy || candidates.length === 0) return;
    await options.exclusive(async () => {
      const { ready, held, earlier } = holdUnchecked(candidates, await loadWriteLog(), readAt);
      for (const day of held) {
        results.set(day.harvest.date, {
          text: 'Saved without a check. Compare again.',
          kind: 'warn',
        });
      }
      if (held.length > 0) refreshBadges();
      const chosen =
        ready.length > 0 ? await confirmWrite(ready, earlier, { container: barRoot }) : [];
      if (chosen.length === 0) return;
      busy = true;
      updateButtons();
      const { written, stop } = await runWrites(chosen, {
        send: (week) => writeDays(doc, week, options),
        show: (date, text, kind) => {
          results.set(date, { text, kind });
          refreshBadges();
        },
      });
      busy = false;
      refreshBadges();
      updateButtons();
      showStatus(
        stop
          ? `Wrote ${written.length} of ${chosen.length}, then stopped at ${stop}. Compare again to continue.`
          : `Wrote and checked ${written.length} ${written.length === 1 ? 'day' : 'days'}.`,
        stop ? 'error' : 'ok',
      );
    });
  }

  checkButton.addEventListener('click', () => void check());
  writeAll.addEventListener('click', () => void write(remaining()));

  return {
    check,
    unmount() {
      observer.disconnect();
      barHost.remove();
      for (const host of doc.querySelectorAll(BADGE_TAG)) host.remove();
    },
  };
}
