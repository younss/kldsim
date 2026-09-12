/**
 * Tunable coefficients for round resolution. Kept as named constants (not
 * magic numbers inline) so a scenario designer or a future difficulty slider
 * can override them per-scenario without touching the engine.
 */
export const SCORING_CONSTANTS = {
  /** Technical debt burned down per unit of modernization spend (fraction of round budget). */
  DEBT_PAYDOWN_RATE: 28,
  /** Technical debt accrued per unit of new-feature spend when debt isn't also addressed. */
  DEBT_ACCRUAL_FROM_FEATURES: 14,
  /** Debt that accrues every round regardless of spend (entropy). */
  DEBT_NATURAL_DRIFT: 3,
  /** Velocity gained per unit of new-feature spend. */
  VELOCITY_GAIN_FROM_FEATURES: 22,
  /** Velocity gained per unit of modernization spend (paying down debt unblocks throughput). */
  VELOCITY_GAIN_FROM_MODERNIZATION: 9,
  /** Velocity points lost per point of technicalDebtIndex, e.g. TDI 50 -> -9 velocity. */
  VELOCITY_DRAG_PER_DEBT_POINT: 0.18,
  /** Opex penalty multiplier applied to TCO per point of technicalDebtIndex, scaled 0-1. */
  TCO_DEBT_PENALTY_PER_POINT: 0.012,
  /** Debt drift applied to a node an action was submitted for but set to IGNORE. */
  NODE_PASSIVE_DRIFT_IGNORED: 4,
  /** Debt drift applied to a node that received no action at all this round (organizational entropy). */
  NODE_PASSIVE_DRIFT_UNTOUCHED: 1,
  /** Stakeholder trust gained per unit of stakeholder-engagement spend. */
  TRUST_GAIN_FROM_ENGAGEMENT: 18,
  /** Stakeholder trust lost per unit of risk-mitigation underspend when a crisis event fires. */
  TRUST_LOSS_UNMITIGATED_CRISIS: 15,
  /** Trust recovered per unit of risk-mitigation spend, independent of events. */
  TRUST_GAIN_FROM_RISK_MITIGATION: 10,
  /** How strongly a resolved negotiation's trustDelta feeds into the aggregate metric (0-1). */
  NEGOTIATION_TRUST_WEIGHT: 0.6,
  /** Debt reduction applied to a single node when its action is MODERNIZE. */
  NODE_MODERNIZE_DEBT_REDUCTION: 60,
  /** Debt reduction applied to a single node when its action is PATCH (cheaper, less effective). */
  NODE_PATCH_DEBT_REDUCTION: 20,
  /** Weights for the composite score, must sum to 1. */
  COMPOSITE_WEIGHTS: {
    technicalDebtIndex: 0.25, // inverted — lower debt is better
    deliveryVelocity: 0.3,
    stakeholderTrust: 0.25,
    tcoEfficiency: 0.2, // inverted, normalized against scenario budget envelope
  },
} as const;

export const ALLOCATION_KEYS = [
  "modernization",
  "newFeatures",
  "riskMitigation",
  "stakeholderEngagement",
] as const;
