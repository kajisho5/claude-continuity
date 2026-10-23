import { costOf, type UsageTokens } from "./pricing";

export type PlanId = "max5x" | "max20x" | "team" | "custom" | "none";
export type CreditSettings = {
  /** null means the user skipped setup ("あとで設定"). */
  plan: PlanId | null;
  monthlyAmountUsd: number;
  resetDay: number;
  calibration?: { balanceUsd: number; observedAt: string };
  onboardingDone: boolean;
};
export type UsageRow = UsageTokens & { model: string; createdAt: string; sessionId?: string; source?: string };
export type Pace = "under" | "on" | "over";
export type CreditSummary = {
  plan: PlanId;
  monthlyAmountUsd: number;
  spentUsd: number;
  remainingUsd: number;
  cycleStart: Date;
  cycleEnd: Date;
  daysLeft: number;
  elapsedRatio: number;
  usedRatio: number;
  dailyBudgetUsd: number;
  pace: Pace;
  unpricedCalls: number;
  calibrated: boolean;
  calibratedAt?: Date;
};

export const PLAN_PRESETS: Record<Exclude<PlanId, "team" | "custom">, number> = { max5x: 100, max20x: 200, none: 0 };
export const PLAN_LABELS: Record<PlanId, string> = {
  max5x: "Max 5x", max20x: "Max 20x", team: "Team", custom: "カスタム", none: "対象外"
};
const DAY_MS = 24 * 60 * 60 * 1000;
// Pace bands: more than 10 points behind or ahead of the elapsed share of the cycle.
const PACE_TOLERANCE = 0.1;

/** The given day of a month, clamped to that month's last day (e.g. day 31 in February -> 28/29). */
function clampedDate(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

/** Local-time billing cycle [start, end) that contains `now` for credits granted on `resetDay`. */
export function cycleRange(resetDay: number, now: Date): { start: Date; end: Date } {
  const day = Math.min(31, Math.max(1, Math.round(resetDay)));
  let start = clampedDate(now.getFullYear(), now.getMonth(), day);
  if (start.getTime() > now.getTime()) start = clampedDate(now.getFullYear(), now.getMonth() - 1, day);
  const end = clampedDate(start.getFullYear(), start.getMonth() + 1, day);
  return { start, end };
}

function spentBetween(rows: UsageRow[], from: Date, to: Date): { spent: number; unpriced: number } {
  let spent = 0;
  let unpriced = 0;
  for (const row of rows) {
    const at = Date.parse(row.createdAt);
    if (!Number.isFinite(at) || at < from.getTime() || at >= to.getTime()) continue;
    const cost = costOf(row.model, row);
    if (cost == null) unpriced++;
    else spent += cost;
  }
  return { spent, unpriced };
}

export function summarizeCredit(rows: UsageRow[], settings: CreditSettings | null, now: Date): CreditSummary | null {
  if (!settings || settings.plan == null) return null;
  const { start, end } = cycleRange(settings.resetDay || 1, now);
  const { spent, unpriced } = spentBetween(rows, start, end);
  const amount = settings.plan === "none" ? 0 : settings.monthlyAmountUsd;

  let remaining = amount - spent;
  let calibrated = false;
  let calibratedAt: Date | undefined;
  const observed = settings.calibration ? new Date(settings.calibration.observedAt) : null;
  // A balance read in an earlier cycle has already expired, so it no longer applies.
  if (settings.calibration && observed && observed >= start && observed < end && observed <= now) {
    remaining = settings.calibration.balanceUsd - spentBetween(rows, observed, end).spent;
    calibrated = true;
    calibratedAt = observed;
  }

  const cycleMs = end.getTime() - start.getTime();
  const elapsedRatio = Math.min(1, Math.max(0, (now.getTime() - start.getTime()) / cycleMs));
  const usedRatio = amount > 0 ? (amount - remaining) / amount : 0;
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS));
  const pace: Pace = usedRatio < elapsedRatio - PACE_TOLERANCE ? "under"
    : usedRatio > elapsedRatio + PACE_TOLERANCE ? "over" : "on";

  return {
    plan: settings.plan, monthlyAmountUsd: amount, spentUsd: spent, remainingUsd: remaining,
    cycleStart: start, cycleEnd: end, daysLeft, elapsedRatio, usedRatio,
    dailyBudgetUsd: Math.max(remaining, 0) / Math.max(daysLeft, 1),
    pace, unpricedCalls: unpriced, calibrated, calibratedAt
  };
}

export function formatShortDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
