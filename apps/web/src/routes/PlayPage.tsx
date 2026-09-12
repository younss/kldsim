import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  SOCKET_EVENTS,
  type BudgetAllocation,
  type Decision,
  type GameSession,
  type NodeAction,
  type Scenario,
  type SessionStatePayload,
  type Team,
  type TeamTopologyUpdatedPayload,
} from "@kldsim/shared";
import { api } from "../lib/apiClient";
import { connectSocket } from "../lib/socketClient";
import { useSocketEvent } from "../hooks/useSocketEvent";
import { MetricsGrid } from "../components/telemetry/MetricsGrid";
import { TopologyCanvas } from "../components/topology/TopologyCanvas";
import { TopologyLegend } from "../components/topology/TopologyLegend";
import { DecisionForm } from "../components/decisions/DecisionForm";
import { NegotiationPanel } from "../components/negotiation/NegotiationPanel";
import { Card } from "../components/common/Card";
import { formatDuration } from "../lib/format";

type SessionWithScenario = GameSession & { scenario: Scenario };

export default function PlayPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<SessionWithScenario | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [remaining, setRemaining] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);

  function loadDecision(sid: string, teamId: string, round: number) {
    api.get<{ decision: Decision | null }>(`/api/sessions/${sid}/teams/${teamId}/rounds/${round}/decision`).then((data) => setDecision(data.decision));
  }

  function loadAll() {
    if (!sessionId) return;
    api.get<{ session: SessionWithScenario }>(`/api/sessions/${sessionId}`).then((data) => {
      setSession(data.session);
      if (data.session.status === "COMPLETED") navigate(`/sessions/${sessionId}/debrief`);
    });
    api.get<{ team: Team }>(`/api/sessions/${sessionId}/teams/me`).then((data) => {
      setTeam(data.team);
    });
  }

  useEffect(loadAll, [sessionId]);

  useEffect(() => {
    if (!session || !team) return;
    loadDecision(session.id, team.id, session.currentRound);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, team?.id, session?.currentRound]);

  useEffect(() => {
    if (!sessionId || !team) return;
    const socket = connectSocket();
    socket.emit(SOCKET_EVENTS.JOIN_SESSION, { sessionId });
    socket.emit(SOCKET_EVENTS.JOIN_TEAM, { sessionId, teamId: team.id });
  }, [sessionId, team?.id]);

  useEffect(() => {
    if (!session?.roundStartedAt) {
      setRemaining(0);
      return;
    }
    const startedAt = new Date(session.roundStartedAt).getTime();
    const tick = () => setRemaining(Math.max(0, session.roundDurationSeconds - Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session?.roundStartedAt, session?.roundDurationSeconds]);

  useSocketEvent<SessionStatePayload>(
    SOCKET_EVENTS.SESSION_STATE,
    (payload) => {
      if (payload.session.id !== sessionId) return;
      setSession((prev) => (prev ? { ...prev, ...payload.session } : prev));
      const myTeam = payload.teams.find((t) => t.id === team?.id);
      if (myTeam) setTeam(myTeam);
      if (payload.session.status === "COMPLETED") navigate(`/sessions/${sessionId}/debrief`);
    },
    [sessionId, team?.id],
  );

  useSocketEvent<TeamTopologyUpdatedPayload>(
    SOCKET_EVENTS.TEAM_TOPOLOGY_UPDATED,
    (payload) => {
      if (payload.teamId !== team?.id) return;
      setTeam((prev) => (prev ? { ...prev, topology: payload.topology, metrics: payload.metrics } : prev));
    },
    [team?.id],
  );

  useSocketEvent<{ roundNumber: number }>(
    SOCKET_EVENTS.ROUND_RESOLVED,
    (payload) => {
      setBanner(`Round ${payload.roundNumber} resolved — round ${payload.roundNumber + 1} has begun.`);
      setTimeout(() => setBanner(null), 6000);
    },
    [],
  );

  if (!session || !team) return <p className="text-sm text-slate-500">Loading session…</p>;

  async function handleSaveDraft(allocation: BudgetAllocation, nodeActions: NodeAction[], rationale: string) {
    if (!session || !team) return;
    await api.put(`/api/sessions/${session.id}/teams/${team.id}/rounds/${session.currentRound}/decision`, { allocation, nodeActions, rationale });
    loadDecision(session.id, team.id, session.currentRound);
  }

  async function handleSubmitDecision(allocation: BudgetAllocation, nodeActions: NodeAction[], rationale: string) {
    if (!session || !team) return;
    await api.post(`/api/sessions/${session.id}/teams/${team.id}/rounds/${session.currentRound}/decision/submit`, { allocation, nodeActions, rationale });
    loadDecision(session.id, team.id, session.currentRound);
  }

  const locked = decision?.status === "SUBMITTED" || decision?.status === "RESOLVED";

  return (
    <div className="space-y-4">
      {banner && <div className="rounded-md border border-brand-500/40 bg-brand-500/10 px-4 py-2 text-sm text-brand-300">{banner}</div>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">{session.scenario.title}</h1>
          <p className="text-sm text-slate-400">
            {team.name} · Round {session.currentRound} of {session.scenario.totalRounds}
          </p>
        </div>
        <div className="rounded-md border border-surface-border bg-surface px-4 py-2 text-center">
          <div className="text-[10px] uppercase text-slate-500">Time remaining</div>
          <div className="font-mono text-lg text-white">{formatDuration(remaining)}</div>
        </div>
      </div>

      <MetricsGrid metrics={team.metrics} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          <TopologyLegend />
          <TopologyCanvas topology={team.topology} selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} height={420} />
          <DecisionForm
            topology={team.topology}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            locked={locked}
            initialAllocation={
              decision
                ? {
                    modernization: decision.allocation.modernization * 100,
                    newFeatures: decision.allocation.newFeatures * 100,
                    riskMitigation: decision.allocation.riskMitigation * 100,
                    stakeholderEngagement: decision.allocation.stakeholderEngagement * 100,
                  }
                : undefined
            }
            initialNodeActions={decision?.nodeActions}
            onSaveDraft={handleSaveDraft}
            onSubmit={handleSubmitDecision}
          />
        </div>
        <div>
          <NegotiationPanel sessionId={session.id} teamId={team.id} personas={session.scenario.personas} />
        </div>
      </div>

      <Card className="text-xs text-slate-500">Objectives: {session.scenario.objectives.join(" · ")}</Card>
    </div>
  );
}
