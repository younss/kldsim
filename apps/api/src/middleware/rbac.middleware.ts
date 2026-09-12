import type { RequestHandler } from "express";
import type { PlatformRole } from "@kldsim/shared";
import { ForbiddenError, UnauthorizedError } from "../errors.js";

export function requireRole(...roles: PlatformRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(new UnauthorizedError());
      return;
    }
    if (!roles.includes(req.auth.role)) {
      next(new ForbiddenError(`This action requires one of the following roles: ${roles.join(", ")}`));
      return;
    }
    next();
  };
}
