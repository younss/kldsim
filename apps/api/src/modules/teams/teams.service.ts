import type { EnterpriseMetrics, TopologyGraph, Team as SharedTeam } from "@kldsim/shared";
import { prisma } from "../../db.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../errors.js";
import { SessionStatus } from "../../../generated/prisma/index.js";
import type { Team as PrismaTeam, TeamMember } from "../../../generated/prisma/index.js";
import { toJson } from "../../lib/json.js";

type TeamWithMembers = PrismaTeam & { members: TeamMember[] };

/** Prisma's relational `members: TeamMember[]` (join rows) -> the flat `memberUserIds` shape the client and @kldsim/shared agree on. */
export function serializeTeam(team: TeamWithMembers): SharedTeam {
  return {
    id: team.id,
    sessionId: team.sessionId,
    name: team.name,
    memberUserIds: team.members.map((m) => m.userId),
    metrics: team.metrics as unknown as SharedTeam["metrics"],
    topology: team.topology as unknown as SharedTeam["topology"],
    eliminated: team.eliminated,
  };
}

export async function listTeams(sessionId: string): Promise<SharedTeam[]> {
  const teams = await prisma.team.findMany({ where: { sessionId }, include: { members: true }, orderBy: { createdAt: "asc" } });
  return teams.map(serializeTeam);
}

export async function getTeam(sessionId: string, teamId: string): Promise<SharedTeam> {
  const team = await prisma.team.findFirst({ where: { id: teamId, sessionId }, include: { members: true } });
  if (!team) throw new NotFoundError("Team not found");
  return serializeTeam(team);
}

export async function createTeam(tenantId: string, sessionId: string, name: string, memberUserIds: string[]): Promise<SharedTeam> {
  const session = await prisma.gameSession.findFirst({ where: { id: sessionId, tenantId } });
  if (!session) throw new NotFoundError("Session not found");
  if (session.status !== SessionStatus.LOBBY) {
    throw new ForbiddenError("Teams can only be added while the session is in the lobby");
  }

  const scenario = await prisma.scenario.findUniqueOrThrow({ where: { id: session.scenarioId } });
  const baselineMetrics = scenario.baselineMetrics as unknown as EnterpriseMetrics;
  const topology = scenario.topology as unknown as TopologyGraph;

  if (memberUserIds.length > 0) {
    const validUsers = await prisma.user.count({ where: { tenantId, id: { in: memberUserIds } } });
    if (validUsers !== memberUserIds.length) throw new BadRequestError("One or more member user ids do not belong to this tenant");
  }

  const team = await prisma.team.create({
    data: {
      sessionId,
      name,
      metrics: toJson(baselineMetrics),
      // Each team gets its own independent deep copy of the scenario topology —
      // node/edge objects are already plain JSON, so re-serializing via Prisma's
      // Json column write is itself the deep copy (no shared references remain).
      topology: toJson(topology),
      members: { create: memberUserIds.map((userId) => ({ userId })) },
    },
    include: { members: true },
  });
  return serializeTeam(team);
}

export async function removeTeam(tenantId: string, sessionId: string, teamId: string): Promise<void> {
  const session = await prisma.gameSession.findFirst({ where: { id: sessionId, tenantId } });
  if (!session) throw new NotFoundError("Session not found");
  if (session.status !== SessionStatus.LOBBY) {
    throw new ForbiddenError("Teams can only be removed while the session is in the lobby");
  }
  const result = await prisma.team.deleteMany({ where: { id: teamId, sessionId } });
  if (result.count === 0) throw new NotFoundError("Team not found");
}

export async function getMyTeam(sessionId: string, userId: string): Promise<SharedTeam> {
  const team = await prisma.team.findFirst({ where: { sessionId, members: { some: { userId } } }, include: { members: true } });
  if (!team) throw new NotFoundError("You are not on a team in this session");
  return serializeTeam(team);
}
