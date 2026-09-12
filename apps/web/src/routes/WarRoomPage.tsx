import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  SOCKET_EVENTS,
  type DecisionSubmittedPayload,
  type GameSession,
  type Scenario,
  type SessionStatePayload,
  type Team,
  type TelemetryEvent,
} from "@kldsim/shared";
import { api, ApiError } from "../lib/apiClient";
import { connectSocket } from "../lib/socketClient";
import { useSocketEvent } from "../hooks/useSocketEvent";
import { Card, CardHeader } from "../components/common/Card";
import { Badge } from "../components/common/Badge";
import { MetricsGrid } from "../components/telemetry/MetricsGrid";
import { formatDuration, timeAgo } from "../lib/format";

type SessionWithScenario = GameSession & { scenario: Scenario };

interface WarRoomSnapshot {
  session: SessionWithScenario & { teams: Team[] };
  decisionStatusByTeam: Array<{ teamId: string; teamName: string; status: string }>;
  recentTelemetry: TelemetryEvent[];
  overrides: Array<{ id: string; kind: string; payload: unknown; issuedAt: string }>;
}

export default function WarRoomPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<WarRoomSnapshot | null>(null);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [broadcastText, setBroadcastText] = useState("");
  const [eventForm, setEventForm] = useState({ title: "", description: "", stakeholderTrust: 0, deliveryVelocity: 0, technicalDebtIndex: 0, tco: 0 });

  function load() {
    if (!sessionId) return;
    api.get<WarRoomSnapshot>(`/api/sessions/${sessionId}/war-room`).then((data) => {
      setSnapshot(data);
      if (!activeTeamId && data.session.teams[0]) setActiveTeamId(data.session.teams[0].id);
      if (data.session.status === "COMPLETED") navigate(`/sessions/${sessionId}/debrief`);
    });
  }

  useEffect(load, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const socket = connectSocket();
    socket.emit(SOCKET_EVENTS.JOIN_SESSION, { sessionId });
  }, [sessionId]);

  useSocketEvent<SessionStatePayload>(SOCKET_EVENTS.SESSION_STATE, (payload) => {
    if (payload.session.id !== sessionId) return;
    load();
  });
  useSocketEvent<DecisionSubmittedPayload>(SOCKET_EVENTS.DECISION_SUBMITTED, load);
  useSocketEvent(SOCKET_EVENTS.ROUND_RESOLVED, load);
  useSocketEvent(SOCKET_EVENTS.TELEMETRY_EVENT, load);

  async function runAction(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    }
  }

  async function handleInjectEvent(e: FormEvent) {
    e.preventDefault();
    await runAction(async () => {
      await api.post(`/api/sessions/${sessionId}/events/inject`, {
        title: eventForm.title,
        description: eventForm.description,
        metricImpact: {
          stakeholderTrust: eventForm.stakeholderTrust || undefined,
          deliveryVelocity: eventForm.deliveryVelocity || undefined,
          technicalDebtIndex: eventForm.technicalDebtIndex || undefined,
          tco: eventForm.tco || undefined,
        },
      });
      setEventForm({ title: "", description: "", stakeholderTrust: 0, deliveryVelocity: 0, technicalDebtIndex: 0, tco: 0 });
      load();
    });
  }

  if (!snapshot) return <p className="text-sm text-slate-500">Loading war room…</p>;
  const { session } = snapshot;
  const activeTeam = session.teams.find((t) => t.id === activeTeamId);
  const remaining = session.roundStartedAt ? Math.max(0, session.roundDurationSeconds - Math.floor((Date.now() - new Date(session.roundStartedAt).getTime()) / 1000)) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">{session.scenario.title} — War Room</h1>
          <p className="text-sm text-slate-400">
            Round {session.currentRound}/{session.scenario.totalRounds} · <Badge tone={session.status === "PAUSED" ? "warning" : "success"}>{session.status}</Badge>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-md border border-surface-border bg-surface px-4 py-2 text-center">
            <div className="text-[10px] uppercase text-slate-500">Remaining</div>
            <div className="font-mono text-lg text-white">{formatDuration(remaining)}</div>
          </div>
          {session.status === "IN_PROGRESS" ? (
            <button onClick={() => runAction(() => api.post(`/api/sessions/${sessionId}/pause`))} className="rounded-md border border-surface-border px-3 py-2 text-sm text-slate-200 hover:bg-white/5">
              Pause
            </button>
          ) : (
            <button onClick={() => runAction(() => api.post(`/api/sessions/${sessionId}/resume`))} className="rounded-md border border-surface-border px-3 py-2 text-sm text-slate-200 hover:bg-white/5">
              Resume
            </button>
          )}
          <button onClick={() => runAction(() => api.post(`/api/sessions/${sessionId}/timer/extend`, { additionalSeconds: 300 }))} className="rounded-md border border-surface-border px-3 py-2 text-sm text-slate-200 hover:bg-white/5">
            +5 min
          </button>
          <button onClick={() => runAction(() => api.post(`/api/sessions/${sessionId}/round/force-end`))} className="rounded-md bg-brand-600 px-3 py-2 text-sm text-white hover:bg-brand-500">
            Force round end
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-health-critical">{error}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Teams" />
          <div className="mb-3 flex flex-wrap gap-2">
            {session.teams.map((team) => {
              const status = snapshot.decisionStatusByTeam.find((d) => d.teamId === team.id)?.status ?? "DRAFT";
              return (
                <button
                  key={team.id}
                  onClick={() => setActiveTeamId(team.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs ${team.id === activeTeamId ? "border-brand-500 bg-brand-500/15 text-brand-300" : "border-surface-border text-slate-400"}`}
                >
                  {team.name} · <Badge tone={status === "SUBMITTED" || status === "RESOLVED" ? "success" : "warning"}>{status}</Badge>
                  {team.eliminated && <span className="ml-1 text-health-critical">eliminated</span>}
                </button>
              );
            })}
          </div>
          {activeTeam && <MetricsGrid metrics={activeTeam.metrics} />}
        </Card>

        <Card>
          <CardHeader title="Live telemetry" />
          <div className="max-h-72 space-y-2 overflow-y-auto scrollbar-thin pr-1 text-xs">
            {snapshot.recentTelemetry.length === 0 && <p className="text-slate-500">No events yet.</p>}
            {snapshot.recentTelemetry.map((event) => (
              <div key={event.id} className="rounded-md border border-surface-border px-2.5 py-1.5">
                <div className="flex justify-between text-slate-300">
                  <span>{event.type.replace(/_/g, " ")}</span>
                  <span className="text-slate-500">{timeAgo(event.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Inject event" subtitle="Applies immediately to every active team" />
          <form onSubmit={handleInjectEvent} className="space-y-2">
            <input
              required
              value={eventForm.title}
              onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Event title"
              className="w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
            />
            <textarea
              required
              value={eventForm.description}
              onChange={(e) => setEventForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Description shown to teams"
              rows={2}
              className="w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
            />
            <div className="grid grid-cols-4 gap-2">
              {(["stakeholderTrust", "deliveryVelocity", "technicalDebtIndex", "tco"] as const).map((key) => (
                <div key={key}>
                  <label className="mb-1 block text-[10px] text-slate-500">{key}</label>
                  <input
                    type="number"
                    value={eventForm[key]}
                    onChange={(e) => setEventForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
                    className="w-full rounded-md border border-surface-border bg-surface px-2 py-1.5 text-xs text-white outline-none focus:border-brand-500"
                  />
                </div>
              ))}
            </div>
            <button type="submit" className="w-full rounded-md bg-brand-600 py-2 text-sm text-white hover:bg-brand-500">
              Inject event
            </button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Broadcast to all teams" />
          <div className="space-y-2">
            <textarea
              value={broadcastText}
              onChange={(e) => setBroadcastText(e.target.value)}
              rows={3}
              placeholder="Message shown live to everyone in the session"
              className="w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
            />
            <button
              onClick={() =>
                runAction(async () => {
                  await api.post(`/api/sessions/${sessionId}/broadcast`, { message: broadcastText });
                  setBroadcastText("");
                })
              }
              className="w-full rounded-md border border-surface-border py-2 text-sm text-slate-200 hover:bg-white/5"
            >
              Broadcast
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
