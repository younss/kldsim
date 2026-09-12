import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Scenario } from "@kldsim/shared";
import { api } from "../lib/apiClient";
import { Card, CardHeader } from "../components/common/Card";
import { Badge } from "../components/common/Badge";

const STATUS_TONE: Record<string, "default" | "brand" | "success" | "warning"> = {
  DRAFT: "default",
  VALIDATED: "brand",
  PUBLISHED: "success",
  ARCHIVED: "warning",
};

export default function StudioListPage() {
  const [scenarios, setScenarios] = useState<Scenario[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ scenarios: Scenario[] }>("/api/scenarios")
      .then((data) => setScenarios(data.scenarios))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Game Studio</h1>
          <p className="text-sm text-slate-400">Author, validate, and publish enterprise-simulation scenarios.</p>
        </div>
        <Link to="/studio/new" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500">
          + Generate scenario
        </Link>
      </div>

      {error && <p className="text-sm text-health-critical">{error}</p>}

      {!scenarios ? (
        <p className="text-sm text-slate-500">Loading scenarios…</p>
      ) : scenarios.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-400">
            No scenarios yet. Describe an industry or business challenge in plain text and the Game Studio will synthesize a full playable
            scenario — narrative, topology, stakeholder personas, and event timeline.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {scenarios.map((scenario) => (
            <Link key={scenario.id} to={`/studio/${scenario.id}`}>
              <Card className="h-full transition-colors hover:border-brand-500/50">
                <CardHeader title={scenario.industry} action={<Badge tone={STATUS_TONE[scenario.status] ?? "default"}>{scenario.status}</Badge>} />
                <h3 className="mb-2 text-base font-semibold text-white">{scenario.title}</h3>
                <p className="line-clamp-3 text-sm text-slate-400">{scenario.narrative}</p>
                <div className="mt-4 flex gap-4 text-xs text-slate-500">
                  <span>{scenario.totalRounds} rounds</span>
                  <span>{scenario.personas.length} personas</span>
                  <span>{scenario.topology.nodes.length} systems</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
