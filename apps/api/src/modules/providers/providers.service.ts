import { LLMProviderKind } from "@kldsim/shared";
import type { UpsertProviderConfigInput, ProviderConfigPublic } from "@kldsim/shared";
import { LLMGateway, createProvider, encryptSecret, decryptSecret } from "@kldsim/llm-gateway";
import type { ProviderCredentials } from "@kldsim/llm-gateway";
import { prisma } from "../../db.js";
import { env } from "../../env.js";
import { NotFoundError } from "../../errors.js";
import type { ProviderConfig as PrismaProviderConfig } from "../../../generated/prisma/index.js";

function toPublic(config: PrismaProviderConfig): ProviderConfigPublic {
  return {
    id: config.id,
    tenantId: config.tenantId,
    provider: config.provider as unknown as LLMProviderKind,
    model: config.model,
    baseUrl: config.baseUrl,
    isDefault: config.isDefault,
    enabled: config.enabled,
    configured: config.provider === LLMProviderKind.OLLAMA || Boolean(config.encryptedApiKey),
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  };
}

export async function listProviderConfigs(tenantId: string): Promise<ProviderConfigPublic[]> {
  const configs = await prisma.providerConfig.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" } });
  return configs.map(toPublic);
}

export async function upsertProviderConfig(tenantId: string, id: string | undefined, input: UpsertProviderConfigInput): Promise<ProviderConfigPublic> {
  const encryptedApiKey = input.apiKey ? encryptSecret(input.apiKey, env.MASTER_ENCRYPTION_KEY) : undefined;

  const result = await prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.providerConfig.updateMany({ where: { tenantId }, data: { isDefault: false } });
    }

    if (id) {
      const existing = await tx.providerConfig.findFirst({ where: { id, tenantId } });
      if (!existing) throw new NotFoundError("Provider configuration not found");
      return tx.providerConfig.update({
        where: { id },
        data: {
          model: input.model,
          baseUrl: input.baseUrl ?? existing.baseUrl,
          encryptedApiKey: encryptedApiKey ?? existing.encryptedApiKey,
          isDefault: input.isDefault ?? existing.isDefault,
          enabled: input.enabled ?? existing.enabled,
        },
      });
    }

    return tx.providerConfig.create({
      data: {
        tenantId,
        provider: input.provider,
        model: input.model,
        baseUrl: input.baseUrl,
        encryptedApiKey,
        isDefault: input.isDefault ?? false,
        enabled: input.enabled ?? true,
      },
    });
  });

  return toPublic(result);
}

export async function deleteProviderConfig(tenantId: string, id: string): Promise<void> {
  const result = await prisma.providerConfig.deleteMany({ where: { id, tenantId } });
  if (result.count === 0) throw new NotFoundError("Provider configuration not found");
}

function toCredentials(config: PrismaProviderConfig): ProviderCredentials {
  return {
    provider: config.provider as unknown as LLMProviderKind,
    model: config.model,
    baseUrl: config.baseUrl ?? undefined,
    apiKey: config.encryptedApiKey ? decryptSecret(config.encryptedApiKey, env.MASTER_ENCRYPTION_KEY) : undefined,
  };
}

/** The implicit, always-available local fallback so the platform works out of the box with zero configuration. */
function ollamaFallbackCredentials(): ProviderCredentials {
  return { provider: LLMProviderKind.OLLAMA, model: env.OLLAMA_DEFAULT_MODEL, baseUrl: env.OLLAMA_BASE_URL };
}

/**
 * Builds a fallback-chain gateway for a tenant: their designated default
 * provider first, then their other enabled providers, then the local Ollama
 * instance as a last resort. This is what "Bring Your Own AI" degrades to
 * when every configured cloud provider is down, rate-limited, or unset.
 */
export async function getTenantGateway(tenantId: string, providerOverride?: LLMProviderKind): Promise<LLMGateway> {
  const configs = await prisma.providerConfig.findMany({
    where: { tenantId, enabled: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  let ordered = configs;
  if (providerOverride) {
    const match = configs.find((c) => c.provider === providerOverride);
    ordered = match ? [match, ...configs.filter((c) => c.id !== match.id)] : configs;
  }

  const credentials = ordered.map(toCredentials);
  const hasOllama = credentials.some((c) => c.provider === LLMProviderKind.OLLAMA);
  if (!hasOllama) credentials.push(ollamaFallbackCredentials());

  return new LLMGateway(credentials.map(createProvider));
}

export async function testProviderHealth(tenantId: string, id: string): Promise<boolean> {
  const config = await prisma.providerConfig.findFirst({ where: { id, tenantId } });
  if (!config) throw new NotFoundError("Provider configuration not found");
  const provider = createProvider(toCredentials(config));
  return provider.healthCheck();
}
