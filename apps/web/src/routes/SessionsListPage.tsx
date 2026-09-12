import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PlatformRole, type GameSession, type Scenario } from "@kldsim/shared";
import { api, ApiError } from "../lib/apiClient";
import { useAuthStore } from "../state/authStore";
import { Card, CardHeader } from "../components/common/Card";
import { Badge } from "../components/common/Badge";
import { timeAgo } from "../lib/format";

type SessionWithScenario = GameSession & { scenario: { title: string } };

const STATUS_TONE: Record<string, "default" | "brand" | "success" | "warning"> = {
  LOBBY: "default",
  IN_PROGRESS: "success",
  PAUSED: "warning",
  COMPLETED: "brand",
};

export default function SessionsListPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isStaff = user?.role === PlatformRole.FACILITATOR || user?.role === PlatformRole.PLATFORM_ADMIN;

  const [sessions, setSessions] = useState<SessionWithScenario[] | null>(null);
  const [publishedScenarios, setPublishedScenarios] = useState<Scenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState("");
  const [roundDurationMinutes, setRoundDurationMinutes] = useState(15);
  const [error, setError] = useState<string | null>(null);

  function load() {
    const endpoint = isStaff ? "/api/sessions" : "/api/sessions/mine";
    api.get<{ sessions: SessionWithScenario[] }>(endpoint).then((data) => setSessions(data.sessions));
  }

  useEffect(load, [isStaff]);

  useEffect(() => {
    if (!isStaff) return;
    api.get<{ scenarios: Scenario[] }>("/api/scenarios?status=PUBLISHED").then((data) => {
      setPublishedScenarios(data.scenarios);
      if (data.scenarios[0]) setSelectedScenarioId(data.scenarios[0].id);
    });
  }, [isStaff]);

  async function handleCreate() {
    setError(null);
    try {
      const data = await api.post<{ session: GameSession }>("/api/sessions", {
        scenarioId: selectedScenarioId,
        roundDurationSeconds: roundDurationMinutes * 60,
      });
      navigate(`/sessions/${data.session.id}/lobby`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create session");
    }
  }

  function sessionLink(session: SessionWithScenario): string {
    if (session.status === "COMPLETED") return `/sessions/${session.id}/debrief`;
    if (session.status === "LOBBY") return `/sessions/${session.id}/lobby`;
    return isStaff ? `/sessions/${session.id}/war-room` : `/sessions/${session.id}/play`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Sessions</h1>
        <p className="text-sm text-slate-400">{isStaff ? "Sessions running in your tenant." : "Sessions you're playing in."}</p>
      </div>

      {isStaff && (
        <Card>
          <CardHeader title="Start a new session" />
          {publishedScenarios.length === 0 ? (
            <p className="text-sm text-slate-500">
              No published scenarios yet.{" "}
              <Link to="/studio" className="text-brand-400 hover:underline">
                Publish one from the Game Studio
              </Link>{" "}
              first.
            </p>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[240px] flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-400">Scenario</label>
                <select
                  value={selectedScenarioId}
                  onChange={(e) => setSelectedScenarioId(e.target.value)}
                  className="w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
                >
                  {publishedScenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Round length (min)</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={roundDurationMinutes}
                  onChange={(e) => setRoundDurationMinutes(Number(e.target.value))}
                  className="w-24 rounded-md border border-surface-border bg-surface px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
                />
              </div>
              <button onClick={handleCreate} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500">
                Create session
              </button>
            </div>
          )}
          {error && <p className="mt-2 text-sm text-health-critical">{error}</p>}
        </Card>
      )}

      {!sessions ? (
        <p className="text-sm text-slate-500">Loading sessions…</p>
      ) : sessions.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-400">No sessions yet.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {sessions.map((session) => (
            <Link key={session.id} to={sessionLink(session)}>
              <Card className="transition-colors hover:border-brand-500/50">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-medium text-white">{session.scenario.title}</h3>
                  <Badge tone={STATUS_TONE[session.status] ?? "default"}>{session.status.replace("_", " ")}</Badge>
                </div>
                <p className="text-xs text-slate-500">
                  Round {session.currentRound} · created {timeAgo(session.createdAt)}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
