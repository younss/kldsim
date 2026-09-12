import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PlatformRole, SOCKET_EVENTS, type GameSession, type Scenario, type SessionStatePayload, type Team } from "@kldsim/shared";
import { api, ApiError } from "../lib/apiClient";
import { connectSocket, getSocket } from "../lib/socketClient";
import { useSocketEvent } from "../hooks/useSocketEvent";
import { useAuthStore } from "../state/authStore";
import { Card, CardHeader } from "../components/common/Card";

interface TenantUser {
  id: string;
  email: string;
  displayName: string;
  role: PlatformRole;
}

export default function SessionLobbyPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isStaff = user?.role === PlatformRole.FACILITATOR || user?.role === PlatformRole.PLATFORM_ADMIN;

  const [session, setSession] = useState<(GameSession & { scenario: Scenario }) | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!sessionId) return;
    api.get<{ session: GameSession & { scenario: Scenario; teams: Team[] } }>(`/api/sessions/${sessionId}`).then((data) => {
      setSession(data.session);
      setTeams(data.session.teams);
    });
  }

  useEffect(load, [sessionId]);

  useEffect(() => {
    if (isStaff) {
      api.get<{ users: TenantUser[] }>("/api/tenants/users").then((data) => setTenantUsers(data.users.filter((u) => u.role === PlatformRole.PLAYER)));
    }
  }, [isStaff]);

  useEffect(() => {
    if (!sessionId) return;
    const socket = connectSocket();
    socket.emit(SOCKET_EVENTS.JOIN_SESSION, { sessionId });
  }, [sessionId]);

  useSocketEvent<SessionStatePayload>(
    SOCKET_EVENTS.SESSION_STATE,
    (payload) => {
      if (payload.session.id !== sessionId) return;
      setSession((prev) => (prev ? { ...prev, ...payload.session } : prev));
      setTeams(payload.teams);
      if (payload.session.status === "IN_PROGRESS") {
        navigate(isStaff ? `/sessions/${sessionId}/war-room` : `/sessions/${sessionId}/play`);
      }
    },
    [sessionId, isStaff],
  );

  async function handleAddTeam() {
    if (!sessionId || !newTeamName.trim()) return;
    setError(null);
    try {
      await api.post(`/api/sessions/${sessionId}/teams`, { name: newTeamName, memberUserIds: selectedMemberIds });
      setNewTeamName("");
      setSelectedMemberIds([]);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add team");
    }
  }

  async function handleRemoveTeam(teamId: string) {
    if (!sessionId) return;
    await api.delete(`/api/sessions/${sessionId}/teams/${teamId}`);
    load();
  }

  async function handleStart() {
    if (!sessionId) return;
    setError(null);
    try {
      await api.post(`/api/sessions/${sessionId}/start`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start session");
    }
  }

  if (!session) return <p className="text-sm text-slate-500">Loading lobby…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">{session.scenario.title}</h1>
        <p className="text-sm text-slate-400">Lobby — waiting for the facilitator to start the session.</p>
      </div>

      <Card>
        <CardHeader title="Teams" subtitle={`${teams.length} team(s) registered`} />
        {teams.length === 0 ? (
          <p className="text-sm text-slate-500">No teams yet.</p>
        ) : (
          <ul className="space-y-2">
            {teams.map((team) => (
              <li key={team.id} className="flex items-center justify-between rounded-md border border-surface-border px-3 py-2 text-sm">
                <div>
                  <span className="text-white">{team.name}</span>
                  <span className="ml-2 text-xs text-slate-500">{team.memberUserIds?.length ?? 0} member(s)</span>
                </div>
                {isStaff && (
                  <button onClick={() => handleRemoveTeam(team.id)} className="text-xs text-health-critical hover:underline">
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {isStaff && (
        <Card>
          <CardHeader title="Add a team" />
          <div className="space-y-3">
            <input
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Team name"
              className="w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
            />
            <div>
              <p className="mb-1 text-xs font-medium text-slate-400">Members</p>
              <div className="flex flex-wrap gap-2">
                {tenantUsers.map((u) => {
                  const selected = selectedMemberIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      onClick={() => setSelectedMemberIds((ids) => (selected ? ids.filter((id) => id !== u.id) : [...ids, u.id]))}
                      className={`rounded-full border px-3 py-1 text-xs ${selected ? "border-brand-500 bg-brand-500/20 text-brand-300" : "border-surface-border text-slate-400 hover:bg-white/5"}`}
                    >
                      {u.displayName}
                    </button>
                  );
                })}
              </div>
            </div>
            <button onClick={handleAddTeam} className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-500">
              Add team
            </button>
          </div>
        </Card>
      )}

      {error && <p className="text-sm text-health-critical">{error}</p>}

      {isStaff && (
        <button
          onClick={handleStart}
          disabled={teams.length === 0}
          className="w-full rounded-md bg-health-healthy/90 py-3 text-sm font-semibold text-black hover:bg-health-healthy disabled:opacity-30"
        >
          Start session
        </button>
      )}
    </div>
  );
}
