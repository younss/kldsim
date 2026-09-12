import { z } from "zod";

/** Structured output contract the LLM must satisfy when scoring a player's proposal. */
export const proposalEvaluationSchema = z.object({
  empathyScore: z.number().min(0).max(100),
  financialAcumenScore: z.number().min(0).max(100),
  strategicAlignmentScore: z.number().min(0).max(100),
  trustDelta: z.number().min(-100).max(100),
  rationale: z.string().min(1).max(600),
  personaReplyMessage: z.string().min(1).max(800),
});

export type ProposalEvaluationSchemaType = z.infer<typeof proposalEvaluationSchema>;

export const sendNegotiationMessageSchema = z.object({
  personaId: z.string().min(1),
  content: z.string().min(1).max(2000),
});

export type SendNegotiationMessageInput = z.infer<typeof sendNegotiationMessageSchema>;
