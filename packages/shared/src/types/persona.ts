import type { UUID } from "./common.js";

export type PersonaArchetype =
  | "IMPATIENT_BU_HEAD"
  | "RISK_AVERSE_CFO"
  | "DELIVERY_LEAD_BYPASSING_ARCHITECTURE"
  | "SKEPTICAL_CISO"
  | "GROWTH_HUNGRY_CMO"
  | "COMPLIANCE_OFFICER"
  | "CUSTOM";

export interface PersonaBias {
  /** Human-readable description of the cognitive bias / blind spot. */
  description: string;
  /** How strongly this bias skews their evaluation of proposals, 0-1. */
  weight: number;
}

export interface StakeholderPersona {
  id: UUID;
  archetype: PersonaArchetype;
  name: string;
  role: string;
  /** What they publicly say they want. */
  statedGoals: string[];
  /** What actually drives their evaluations, not necessarily disclosed to players. */
  hiddenAgenda: string;
  biases: PersonaBias[];
  /** 0-1, how much a broken promise costs vs. a fresh disagreement (higher = grudge-holding). */
  negotiationTolerance: number;
  /** Relative influence on the aggregate stakeholderTrust metric, weights across personas should sum to 1. */
  trustWeight: number;
  /** Starting trust this persona has in the team, 0-100. */
  initialTrust: number;
  avatarSeed: string;
}
