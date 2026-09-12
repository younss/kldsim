import type { ChatMessage } from "../types.js";
import { buildPersonaSystemPrompt, type PersonaContext } from "./personaNegotiation.prompt.js";

const SCHEMA_CONTRACT = `{
  "empathyScore": number 0-100,
  "financialAcumenScore": number 0-100,
  "strategicAlignmentScore": number 0-100,
  "trustDelta": number -100..100 (how much this proposal moves YOUR trust in the team, signed),
  "rationale": string (<=600 chars, your private reasoning about why you scored it this way),
  "personaReplyMessage": string (<=800 chars, what you actually say back to the team in character)
}`;

/**
 * Background scoring path: unlike the live negotiation chat, this call must
 * return structured JSON so the scoring engine can fold trustDelta into the
 * round's stakeholderTrust update. Reuses the same persona system prompt for
 * voice consistency, then appends strict evaluation instructions.
 */
export function buildProposalEvaluationMessages(ctx: PersonaContext, proposalText: string, priorHistory: ChatMessage[] = []): ChatMessage[] {
  const system = `${buildPersonaSystemPrompt(ctx)}

You must now evaluate a specific proposal the team just made to you and respond with ONLY a JSON object — no markdown fences, no prose outside the JSON. Score honestly from your in-character perspective, letting your hidden agenda and biases skew the scores exactly as they would skew your real judgment (a proposal can score well on financialAcumenScore while still costing trust if it violates your hidden agenda). Schema:
${SCHEMA_CONTRACT}`;

  const user = `The team's proposal to you:
"""
${proposalText}
"""

Evaluate it now and return the JSON object.`;

  return [{ role: "system", content: system }, ...priorHistory, { role: "user", content: user }];
}
