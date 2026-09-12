import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { verifyAccessToken } from "../modules/auth/auth.service.js";
import { UnauthorizedError } from "../errors.js";

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(new UnauthorizedError("Missing bearer token"));
    return;
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = verifyAccessToken(token);
    req.auth = { userId: payload.sub, tenantId: payload.tenantId, role: payload.role, email: payload.email };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError("Access token expired", "TOKEN_EXPIRED"));
      return;
    }
    next(new UnauthorizedError("Invalid access token"));
  }
};
