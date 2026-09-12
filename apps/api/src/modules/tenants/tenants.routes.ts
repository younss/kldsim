import { Router } from "express";
import { PlatformRole, inviteUserSchema } from "@kldsim/shared";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/rbac.middleware.js";
import * as tenantsService from "./tenants.service.js";

export const tenantsRouter = Router();
tenantsRouter.use(requireAuth);

tenantsRouter.get(
  "/users",
  requireRole(PlatformRole.PLATFORM_ADMIN, PlatformRole.FACILITATOR),
  asyncHandler(async (req, res) => {
    const users = await tenantsService.listUsers(req.auth!.tenantId);
    res.json({ users });
  }),
);

tenantsRouter.post(
  "/users",
  requireRole(PlatformRole.PLATFORM_ADMIN),
  asyncHandler(async (req, res) => {
    const input = inviteUserSchema.parse(req.body);
    const { user, temporaryPassword } = await tenantsService.inviteUser(req.auth!.tenantId, input);
    res.status(201).json({
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
      temporaryPassword,
    });
  }),
);
