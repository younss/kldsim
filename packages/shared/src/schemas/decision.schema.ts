import { z } from "zod";

export const budgetAllocationSchema = z
  .object({
    modernization: z.number().min(0).max(1),
    newFeatures: z.number().min(0).max(1),
    riskMitigation: z.number().min(0).max(1),
    stakeholderEngagement: z.number().min(0).max(1),
  })
  .refine((a) => Math.abs(a.modernization + a.newFeatures + a.riskMitigation + a.stakeholderEngagement - 1) <= 0.01, {
    message: "Allocation fractions must sum to 1.0",
  });

export const nodeActionSchema = z.object({
  nodeId: z.string().min(1),
  action: z.enum(["MODERNIZE", "DECOMMISSION", "PATCH", "IGNORE"]),
});

export const submitDecisionSchema = z.object({
  allocation: budgetAllocationSchema,
  nodeActions: z.array(nodeActionSchema).max(60),
  rationale: z.string().max(2000).default(""),
});

export type SubmitDecisionInput = z.infer<typeof submitDecisionSchema>;
