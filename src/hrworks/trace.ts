// A step-by-step record of what punchline did in the HRworks tab, for the debug log. It only
// holds page steps, dates, times and counts. Credentials never reach the content script.

export type Trace = {
  log: (line: string) => void;
  lines: () => string[];
};

/** Keeps the newest `max` lines, each prefixed with the seconds since the trace started. */
export function createTrace(max = 2000, now: () => number = Date.now): Trace {
  const started = now();
  const lines: string[] = [];
  return {
    log(line) {
      const seconds = ((now() - started) / 1000).toFixed(1).padStart(6);
      lines.push(`${seconds}s ${line}`);
      if (lines.length > max) lines.splice(0, lines.length - max);
    },
    lines: () => [...lines],
  };
}
