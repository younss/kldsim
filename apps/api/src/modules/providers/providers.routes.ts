import { Router } from "express";
import { PlatformRole, upsertProviderConfigSchema } from "@kldsim/shared";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/rbac.middleware.js";
import * as providersService from "./providers.service.js";

export const providersRouter = Router();
providersRouter.use(requireAuth, requireRole(PlatformRole.PLATFORM_ADMIN));

providersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const configs = await providersService.listProviderConfigs(req.auth!.tenantId);
    res.json({ providers: configs });
  }),
);

providersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = upsertProviderConfigSchema.parse(req.body);
    const config = await providersService.upsertProviderConfig(req.auth!.tenantId, undefined, input);
    res.status(201).json({ provider: config });
  }),
);

providersRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = upsertProviderConfigSchema.parse(req.body);
    const config = await providersService.upsertProviderConfig(req.auth!.tenantId, req.params.id!, input);
    res.json({ provider: config });
  }),
);

providersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await providersService.deleteProviderConfig(req.auth!.tenantId, req.params.id!);
    res.status(204).send();
  }),
);

providersRouter.post(
  "/:id/health-check",
  asyncHandler(async (req, res) => {
    const healthy = await providersService.testProviderHealth(req.auth!.tenantId, req.params.id!);
    res.json({ healthy });
  }),
);
