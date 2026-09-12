import { z } from "zod";
import { LLMProviderKind } from "../types/common.js";

export const upsertProviderConfigSchema = z.object({
  provider: z.nativeEnum(LLMProviderKind),
  model: z.string().min(1).max(120),
  baseUrl: z.string().url().max(300).optional(),
  apiKey: z.string().min(1).max(2000).optional(),
  isDefault: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

export type UpsertProviderConfigInput = z.infer<typeof upsertProviderConfigSchema>;
