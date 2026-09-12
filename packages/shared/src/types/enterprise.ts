/**
 * The four core enterprise KPIs tracked for every team, every round.
 * All are normalized 0-100 except TCO, which is cumulative currency.
 */
export interface EnterpriseMetrics {
  /** Total Cost of Ownership accumulated to date, in scenario currency units. */
  tco: number;
  /** Technical Debt Index — 0 (pristine) to 100 (collapse-imminent). */
  technicalDebtIndex: number;
  /** Delivery Velocity — 0 (stalled) to 100 (elite throughput). */
  deliveryVelocity: number;
  /** Aggregate Stakeholder Trust — 0 (mutiny) to 100 (full alignment). */
  stakeholderTrust: number;
}

export const BASELINE_METRICS: EnterpriseMetrics = {
  tco: 0,
  technicalDebtIndex: 40,
  deliveryVelocity: 55,
  stakeholderTrust: 60,
};

/**
 * Budget allocation a team submits for a round. Fractions of the round
 * budget; must sum to 1 (validated by the decision schema, not this type).
 */
export interface BudgetAllocation {
  modernization: number;
  newFeatures: number;
  riskMitigation: number;
  stakeholderEngagement: number;
}

export interface WinCondition {
  metric: keyof EnterpriseMetrics;
  comparator: "gte" | "lte";
  target: number;
  /** Round at which this condition is evaluated; omit to check only at final round. */
  roundNumber?: number;
}

export interface ScoreBreakdown {
  metrics: EnterpriseMetrics;
  composite: number;
  winConditionsMet: Array<{ condition: WinCondition; met: boolean; actual: number }>;
}
