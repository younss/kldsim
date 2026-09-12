import type { PlatformRole } from "@kldsim/shared";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        tenantId: string;
        role: PlatformRole;
        email: string;
      };
    }
  }
}

export {};
