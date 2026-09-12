import { randomBytes } from "node:crypto";
import type { InviteUserInput } from "@kldsim/shared";
import { prisma } from "../../db.js";
import { ConflictError } from "../../errors.js";
import { hashPassword } from "../auth/auth.service.js";

export function listUsers(tenantId: string) {
  return prisma.user.findMany({
    where: { tenantId },
    select: { id: true, email: true, displayName: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

function generateTemporaryPassword(): string {
  return randomBytes(9).toString("base64url");
}

export async function inviteUser(tenantId: string, input: InviteUserInput) {
  const existing = await prisma.user.findFirst({ where: { tenantId, email: input.email } });
  if (existing) throw new ConflictError("A user with this email already exists in this tenant", "EMAIL_TAKEN");

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const user = await prisma.user.create({
    data: { tenantId, email: input.email, displayName: input.displayName, role: input.role, passwordHash },
  });

  return { user, temporaryPassword };
}
