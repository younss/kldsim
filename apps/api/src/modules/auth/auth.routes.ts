import { Router } from "express";
import rateLimit from "express-rate-limit";
import { registerSchema, loginSchema } from "@kldsim/shared";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { UnauthorizedError } from "../../errors.js";
import * as authService from "./auth.service.js";
import { env } from "../../env.js";
import { prisma } from "../../db.js";

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const REFRESH_COOKIE = "kldsim_refresh_token";

function setRefreshCookie(res: import("express").Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: env.JWT_REFRESH_TTL_SECONDS * 1000,
    path: "/api/auth",
  });
}

authRouter.post(
  "/register",
  authLimiter,
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const { user, tenant, tokens } = await authService.register(input);
    setRefreshCookie(res, tokens.refreshToken);
    res.status(201).json({
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
      tenant: { id: tenant.id, name: tenant.name },
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
    });
  }),
);

authRouter.post(
  "/login",
  authLimiter,
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const { user, tokens } = await authService.login(input);
    setRefreshCookie(res, tokens.refreshToken);
    res.json({
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role, tenantId: user.tenantId },
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
    });
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedError("No refresh token provided");
    const tokens = await authService.refresh(token);
    setRefreshCookie(res, tokens.refreshToken);
    res.json({ accessToken: tokens.accessToken, expiresIn: tokens.expiresIn });
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) await authService.logout(token);
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    res.status(204).send();
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.userId } });
    res.json({ id: user.id, email: user.email, displayName: user.displayName, role: user.role, tenantId: user.tenantId });
  }),
);
