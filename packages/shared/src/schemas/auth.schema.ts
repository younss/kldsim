import { z } from "zod";
import { PlatformRole } from "../types/common.js";

export const registerSchema = z.object({
  tenantName: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(10).max(200),
  displayName: z.string().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

export const inviteUserSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(PlatformRole).refine((role) => role !== PlatformRole.PLATFORM_ADMIN, {
    message: "Cannot invite a user directly as PLATFORM_ADMIN",
  }),
  displayName: z.string().min(1).max(100),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
