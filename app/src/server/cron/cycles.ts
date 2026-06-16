/**
 * Financial-cycle key helpers shared by the cron jobs.
 *
 * A "cycle key" is `YYYY-MM` derived from a date and the user's
 * `cycleStartDay` (1–28). These were previously duplicated inside each cron
 * route; they live here now so the dispatcher and per-user workers agree.
 */

/** The cycle key for the cycle that immediately precedes the current one. */
export function previousCycleKey(today: Date, cycleStartDay: number): string {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() - 1); // ensure we're not on the boundary
  let month = d.getUTCMonth() + 1;
  let year = d.getUTCFullYear();
  if (d.getUTCDate() < cycleStartDay) {
    if (month === 1) {
      month = 12;
      year--;
    } else {
      month--;
    }
  }
  // Previous cycle = one month before the current cycle key
  if (month === 1) {
    month = 12;
    year--;
  } else {
    month--;
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** The cycle key for the cycle that contains `today`. */
export function currentCycleKey(today: Date, cycleStartDay: number): string {
  const d = new Date(today);
  let month = d.getUTCMonth() + 1;
  let year = d.getUTCFullYear();
  if (d.getUTCDate() >= cycleStartDay) {
    if (month === 12) {
      month = 1;
      year++;
    } else {
      month++;
    }
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** The `count` cycle keys immediately preceding the current cycle. */
export function previousCycleKeys(
  today: Date,
  cycleStartDay: number,
  count: number
): string[] {
  const out: string[] = [];
  const d = new Date(today);
  let month = d.getUTCMonth() + 1;
  let year = d.getUTCFullYear();
  if (d.getUTCDate() < cycleStartDay) {
    if (month === 1) {
      month = 12;
      year--;
    } else {
      month--;
    }
  }
  for (let i = 0; i < count; i++) {
    if (month === 1) {
      month = 12;
      year--;
    } else {
      month--;
    }
    out.push(`${year}-${String(month).padStart(2, "0")}`);
  }
  return out;
}
