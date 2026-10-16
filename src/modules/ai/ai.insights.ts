import { z } from 'zod';
import { cached, invalidate } from '../../utils/cache';
import type { StatRange } from '../stats/stats.schema';
import { getDashboardStats, type DashboardStats } from '../stats/stats.service';
import { generateValidated } from './ai.service';

const INSIGHTS_TTL_MS = 10 * 60_000;

export const insightsQuery = z.object({
  range: z.enum(['30d', '90d', '12m']).default('12m'),
  refresh: z
    .enum(['0', '1'])
    .optional()
    .transform((v) => v === '1'),
});

const insightSchema = z.object({
  insights: z
    .array(
      z.object({
        kind: z
          .enum(['trend', 'risk', 'workload', 'mix'])
          .describe('trend = change over time; risk = severity/critical; workload = doctors/specialties; mix = condition/status shares'),
        title: z.string().max(80).describe('A specific headline, max ~10 words, containing the key number.'),
        detail: z.string().max(240).describe('One or two sentences with the supporting numbers. No advice, no speculation about causes.'),
      }),
    )
    .min(2)
    .max(5)
    .describe('3–5 insights, most important first, each about a different aspect.'),
});
export type Insight = z.output<typeof insightSchema>['insights'][number];

const SYSTEM = `You are a healthcare operations analyst writing short dashboard insights for hospital administrators.
You receive AGGREGATED statistics only (no patient records). Write 3–5 insights, most important first.

Rules:
- All data describes patients ADMITTED IN THE SELECTED PERIOD (period.admissions is the total), except monthOverMonth.
- Use ONLY numbers that appear in the data. For percentages, use ONLY the provided sharePct / changePct values —
  never divide numbers yourself, and never relate counts from different groups.
- The last time bucket is still in progress (partial period): never describe it as a drop or decline.
- Write percentages with the % symbol (e.g. 11.7%) and numbers with thousands separators (e.g. 9,765).
- Be specific and neutral. No medical advice, no recommendations, no guesses about causes.
- Each insight covers a different aspect (trend over time, severity/risk, doctor or specialty workload, condition/status mix).`;

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);

/**
 * The exact (small) dataset the model sees — aggregates of the selected period
 * only, with every percentage pre-computed. The all-time snapshot (KPI tiles)
 * is deliberately left out: mixing it with period counts invited invalid
 * ratios ("1,108 critical of 2,956 in care") — real numbers, wrong math.
 */
function toModelInput(s: DashboardStats) {
  const total = s.period.admissions;
  const withShare = (rows: { key: string; count: number }[]) => rows.map((r) => ({ ...r, sharePct: pct(r.count, total) }));
  const points = s.admissionsOverTime.points;
  return {
    period: { range: s.range, from: s.period.from.slice(0, 10), admissions: total },
    monthOverMonth: {
      thisMonthToDate: s.kpis.newThisMonth,
      sameDaysLastMonth: s.kpis.newLastMonthToDate,
      changePct: s.kpis.monthOverMonthChangePct,
    },
    admissionsOverTime: {
      unit: s.admissionsOverTime.unit,
      inProgressBucket: points.at(-1)?.bucket,
      points: points.map((p) => ({ bucket: p.bucket, total: p.total, critical: p.critical, criticalSharePct: pct(p.critical, p.total) })),
    },
    bySeverity: withShare(s.bySeverity),
    byStatus: withShare(s.byStatus),
    byCondition: withShare(s.byCondition),
    bySpecialization: s.bySpecialization.map((x) => ({
      specialty: x.key,
      doctors: x.doctors,
      patients: x.patients,
      sharePct: pct(x.patients, total),
      patientsPerDoctor: x.doctors ? Math.round(x.patients / x.doctors) : null,
    })),
    topDoctors: s.topDoctors.slice(0, 5).map((d) => ({ name: `Dr. ${d.name}`, specialization: d.specialization, patients: d.patients })),
  };
}

/**
 * Grounding check, after generation:
 * - every count of 10 or more must appear in the input data (years exempt);
 * - every percentage must match one we pre-computed (±0.5) — a percentage we
 *   didn't provide means the model did its own (possibly invalid) math.
 * Insights that fail are dropped instead of shown.
 */
function groundedOnly(insights: Insight[], input: unknown) {
  const numbers = new Set<number>();
  const percents: number[] = [];
  const collect = (v: unknown, key = '') => {
    if (typeof v === 'number') {
      numbers.add(Math.round(v));
      if (/Pct$/.test(key)) percents.push(v);
    } else if (Array.isArray(v)) v.forEach((x) => collect(x, key));
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => collect(x, k));
  };
  collect(input);

  const kept: Insight[] = [];
  let dropped = 0;
  for (const insight of insights) {
    const text = `${insight.title} ${insight.detail}`;
    let ok = true;
    // "11.7%" and "11.7 percent" are both percentages — the word form must not bypass the check.
    for (const m of text.matchAll(/(\d[\d,]*(?:\.\d+)?)(\s*(?:%|percent\b|per cent\b))?/gi)) {
      const n = Number(m[1]!.replace(/,/g, ''));
      if (m[2]) {
        if (!percents.some((p) => Math.abs(Math.abs(p) - n) <= 0.5)) ok = false;
      } else if (n >= 10 && !(n >= 1900 && n <= 2100) && !numbers.has(Math.round(n))) {
        ok = false;
      }
    }
    if (ok) kept.push(insight);
    else dropped++;
  }
  return { kept, dropped };
}

async function generate(range: StatRange) {
  const stats = await getDashboardStats(range);
  const input = toModelInput(stats);
  const { insights } = await generateValidated(
    { feature: 'insights', system: SYSTEM, prompt: `Dashboard data (JSON):\n${JSON.stringify(input)}`, temperature: 0.2 },
    insightSchema,
  );
  const { kept, dropped } = groundedOnly(insights, input);
  if (dropped) console.log(`[ai] feature=insights grounding dropped=${dropped} kept=${kept.length}`);
  return { range, generatedAt: new Date().toISOString(), basedOn: stats.generatedAt, insights: kept, dropped };
}

/** Exposed for unit checks of the grounding rules. */
export const __test = { groundedOnly };

export function getInsights(range: StatRange, refresh: boolean) {
  const key = `ai:insights:${range}`;
  if (refresh) invalidate(key);
  return cached(key, INSIGHTS_TTL_MS, () => generate(range));
}
