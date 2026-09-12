import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createHash, randomUUID } from "node:crypto";
import { PlatformRole } from "@kldsim/shared";
import type { RegisterInput, LoginInput } from "@kldsim/shared";
import { prisma } from "../../db.js";
import { env } from "../../env.js";
import { ConflictError, UnauthorizedError } from "../../errors.js";

const BCRYPT_ROUNDS = 12;

export interface AccessTokenPayload {
  sub: string;
  tenantId: string;
  role: PlatformRole;
  email: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

export function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_TTL_SECONDS });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function issueRefreshToken(userId: string): Promise<string> {
  const token = randomUUID() + randomUUID();
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000);
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });
  return token;
}

/**
 * Accepts `role` as a plain string rather than PlatformRole: callers always
 * pass a Prisma User row, whose generated enum type is structurally
 * identical but nominally distinct from @kldsim/shared's PlatformRole. The
 * single cast below is the one place that boundary gets crossed.
 */
async function issueTokenPair(user: { id: string; tenantId: string; role: string; email: string }): Promise<AuthTokens> {
  const accessToken = signAccessToken({ sub: user.id, tenantId: user.tenantId, role: user.role as unknown as PlatformRole, email: user.email });
  const refreshToken = await issueRefreshToken(user.id);
  return { accessToken, refreshToken, expiresIn: env.JWT_ACCESS_TTL_SECONDS };
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findFirst({ where: { email: input.email } });
  if (existing) throw new ConflictError("An account with this email already exists", "EMAIL_TAKEN");

  const tenant = await prisma.tenant.create({ data: { name: input.tenantName } });
  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: input.email,
      passwordHash,
      displayName: input.displayName,
      role: PlatformRole.PLATFORM_ADMIN,
    },
  });

  const tokens = await issueTokenPair(user);
  return { user, tenant, tokens };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findFirst({ where: { email: input.email } });
  if (!user) throw new UnauthorizedError("Invalid email or password", "INVALID_CREDENTIALS");

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) throw new UnauthorizedError("Invalid email or password", "INVALID_CREDENTIALS");

  const tokens = await issueTokenPair(user);
  return { user, tokens };
}

export async function refresh(refreshToken: string): Promise<AuthTokens> {
  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw new UnauthorizedError("Refresh token is invalid or expired", "INVALID_REFRESH_TOKEN");
  }

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
  return issueTokenPair(stored.user);
}

export async function logout(refreshToken: string): Promise<void> {
  const tokenHash = hashToken(refreshToken);
  await prisma.refreshToken.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
}
