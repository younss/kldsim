import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { computeBudgetEnvelope, computeComposite, computeTcoEfficiency, type GameSession, type RoundResult, type Scenario, type Team } from "@kldsim/shared";
import { api } from "../lib/apiClient";
import { Card, CardHeader } from "../components/common/Card";
import { formatCurrency } from "../lib/format";

type SessionWithTeams = GameSession & { scenario: Scenario; teams: Team[] };

const TEAM_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300"];

export default function DebriefPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<SessionWithTeams | null>(null);
  const [results, setResults] = useState<RoundResult[]>([]);

  useEffect(() => {
    if (!sessionId) return;
    api.get<{ session: SessionWithTeams; results: RoundResult[] }>(`/api/sessions/${sessionId}/debrief`).then((data) => {
      setSession(data.session);
      setResults(data.results);
    });
  }, [sessionId]);

  if (!session) return <p className="text-sm text-slate-500">Loading debrief…</p>;

  const envelope = computeBudgetEnvelope(session.scenario.roundBudget, session.scenario.totalRounds);
  const radarData = ["Delivery Velocity", "Debt Health", "Stakeholder Trust", "Cost Efficiency"].map((axis) => {
    const row: Record<string, string | number> = { axis };
    for (const team of session.teams) {
      row[team.name] =
        axis === "Delivery Velocity"
          ? team.metrics.deliveryVelocity
          : axis === "Debt Health"
            ? 100 - team.metrics.technicalDebtIndex
            : axis === "Stakeholder Trust"
              ? team.metrics.stakeholderTrust
              : computeTcoEfficiency(team.metrics.tco, envelope);
    }
    return row;
  });

  const leaderboard = [...session.teams]
    .map((team) => ({ team, composite: computeComposite(team.metrics, envelope) }))
    .sort((a, b) => b.composite - a.composite);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white">{session.scenario.title} — Debrief</h1>
        <p className="text-sm text-slate-400">Final results across {session.scenario.totalRounds} rounds.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Leaderboard" subtitle="Composite score (debt, velocity, trust, cost efficiency)" />
          <ol className="space-y-2">
            {leaderboard.map(({ team, composite }, i) => (
              <li key={team.id} className="flex items-center justify-between rounded-md border border-surface-border px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">#{i + 1}</span>
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TEAM_COLORS[i % TEAM_COLORS.length] }} />
                  <span className="text-white">{team.name}</span>
                  {team.eliminated && <span className="text-xs text-health-critical">(eliminated)</span>}
                </div>
                <span className="tabular-nums text-slate-300">{composite.toFixed(1)}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <CardHeader title="Team comparison" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="75%">
                <PolarGrid stroke="#243044" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 9 }} />
                {session.teams.map((team, i) => (
                  <Radar
                    key={team.id}
                    name={team.name}
                    dataKey={team.name}
                    stroke={TEAM_COLORS[i % TEAM_COLORS.length]}
                    fill={TEAM_COLORS[i % TEAM_COLORS.length]}
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                <Tooltip contentStyle={{ background: "#121c2e", border: "1px solid #243044", fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Round-by-round replay" />
        <div className="max-h-96 space-y-2 overflow-y-auto scrollbar-thin pr-1">
          {results.map((result) => {
            const team = session.teams.find((t) => t.id === result.teamId);
            return (
              <div key={`${result.teamId}-${result.roundNumber}`} className="rounded-md border border-surface-border px-3 py-2 text-sm">
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <span>
                    Round {result.roundNumber} · {team?.name ?? "Unknown team"}
                  </span>
                  <span>TCO {formatCurrency(result.metricsAfter.tco)}</span>
                </div>
                <p className="text-slate-300">{result.narrative}</p>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
