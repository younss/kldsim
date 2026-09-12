import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Scenario } from "@kldsim/shared";
import { api, ApiError } from "../lib/apiClient";
import { Card, CardHeader } from "../components/common/Card";
import { Badge } from "../components/common/Badge";
import { TopologyCanvas } from "../components/topology/TopologyCanvas";
import { TopologyLegend } from "../components/topology/TopologyLegend";
import { formatCurrency } from "../lib/format";

type Tab = "overview" | "topology" | "personas" | "timeline" | "json";

export default function ScenarioEditorPage() {
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const navigate = useNavigate();
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [jsonDraft, setJsonDraft] = useState("");
  const [issues, setIssues] = useState<Array<{ path: string; message: string }> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    if (!scenarioId) return;
    api.get<{ scenario: Scenario }>(`/api/scenarios/${scenarioId}`).then((data) => {
      setScenario(data.scenario);
      setJsonDraft(JSON.stringify(data.scenario, null, 2));
    });
  }

  useEffect(load, [scenarioId]);

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleValidate() {
    if (!scenarioId) return;
    const result = await api.post<{ valid: boolean; issues: Array<{ path: string; message: string }> }>(`/api/scenarios/${scenarioId}/validate`);
    setIssues(result.issues);
    setMessage(result.valid ? "Scenario is valid and ready to publish." : `${result.issues.length} validation issue(s) found.`);
    load();
  }

  async function handlePublish() {
    if (!scenarioId) return;
    await api.post(`/api/scenarios/${scenarioId}/publish`);
    setMessage("Scenario published.");
    load();
  }

  async function handleArchive() {
    if (!scenarioId) return;
    await api.post(`/api/scenarios/${scenarioId}/archive`);
    load();
  }

  async function handleApplyJson() {
    if (!scenarioId) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonDraft);
    } catch {
      setMessage("Invalid JSON — fix syntax errors before applying.");
      return;
    }
    const { title, industry, narrative, objectives, winConditions, lossConditions, totalRounds, roundBudget, baselineMetrics, topology, personas, timeline } =
      parsed;
    await api.patch(`/api/scenarios/${scenarioId}`, {
      title,
      industry,
      narrative,
      objectives,
      winConditions,
      lossConditions,
      totalRounds,
      roundBudget,
      baselineMetrics,
      topology,
      personas,
      timeline,
    });
    setMessage("Changes applied. Re-run validation before publishing.");
    load();
  }

  if (!scenario) return <p className="text-sm text-slate-500">Loading scenario…</p>;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-xl font-semibold text-white">{scenario.title}</h1>
            <Badge tone={scenario.status === "PUBLISHED" ? "success" : scenario.status === "VALIDATED" ? "brand" : "default"}>{scenario.status}</Badge>
          </div>
          <p className="text-sm text-slate-400">{scenario.industry}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => runAction(handleValidate)} disabled={busy} className="rounded-md border border-surface-border px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5">
            Validate
          </button>
          <button
            onClick={() => runAction(handlePublish)}
            disabled={busy || scenario.status !== "VALIDATED"}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-500 disabled:opacity-40"
          >
            Publish
          </button>
          <button onClick={() => runAction(handleArchive)} disabled={busy} className="rounded-md border border-surface-border px-3 py-1.5 text-sm text-slate-400 hover:bg-white/5">
            Archive
          </button>
          {scenario.status === "PUBLISHED" && (
            <button
              onClick={() => navigate("/sessions")}
              className="rounded-md border border-health-healthy/40 px-3 py-1.5 text-sm text-health-healthy hover:bg-health-healthy/10"
            >
              Start a session →
            </button>
          )}
        </div>
      </div>

      {message && <div className="mb-4 rounded-md border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-sm text-brand-300">{message}</div>}
      {issues && issues.length > 0 && (
        <Card className="mb-4 border-health-critical/30">
          <p className="mb-2 text-sm font-medium text-health-critical">Validation issues</p>
          <ul className="space-y-1 text-xs text-slate-400">
            {issues.map((issue, i) => (
              <li key={i}>
                <span className="text-slate-500">{issue.path || "(root)"}:</span> {issue.message}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mb-4 flex gap-1 border-b border-surface-border">
        {(["overview", "topology", "personas", "timeline", "json"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm capitalize ${tab === t ? "border-b-2 border-brand-500 text-white" : "text-slate-500 hover:text-slate-300"}`}
          >
            {t === "json" ? "Raw JSON" : t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-4">
          <Card>
            <CardHeader title="Narrative" />
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">{scenario.narrative}</p>
          </Card>
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader title="Objectives" />
              <ul className="list-disc space-y-1 pl-4 text-sm text-slate-300">
                {scenario.objectives.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardHeader title="Scenario parameters" />
              <dl className="space-y-1.5 text-sm">
                <Row label="Total rounds" value={String(scenario.totalRounds)} />
                <Row label="Round budget" value={formatCurrency(scenario.roundBudget)} />
                <Row label="Baseline debt index" value={String(scenario.baselineMetrics.technicalDebtIndex)} />
                <Row label="Baseline velocity" value={String(scenario.baselineMetrics.deliveryVelocity)} />
                <Row label="Baseline trust" value={String(scenario.baselineMetrics.stakeholderTrust)} />
              </dl>
            </Card>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader title="Win conditions" />
              <ConditionList conditions={scenario.winConditions} />
            </Card>
            <Card>
              <CardHeader title="Loss conditions" />
              <ConditionList conditions={scenario.lossConditions} />
            </Card>
          </div>
        </div>
      )}

      {tab === "topology" && (
        <div className="space-y-3">
          <TopologyLegend />
          <TopologyCanvas topology={scenario.topology} height={480} />
          <Card>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {scenario.topology.nodes.map((node) => (
                <div key={node.id} className="flex items-center justify-between rounded-md border border-surface-border px-3 py-2 text-xs">
                  <div>
                    <div className="text-slate-200">{node.label}</div>
                    <div className="text-slate-500">
                      {node.kind} · debt {node.debtLoad}
                    </div>
                  </div>
                  {node.isBottleneck && <Badge tone="danger">bottleneck</Badge>}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "personas" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {scenario.personas.map((persona) => (
            <Card key={persona.id}>
              <CardHeader title={persona.name} subtitle={persona.role} action={<Badge tone="brand">{persona.archetype.replace(/_/g, " ")}</Badge>} />
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-xs uppercase text-slate-500">Stated goals</span>
                  <ul className="list-disc pl-4 text-slate-300">
                    {persona.statedGoals.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-4 text-xs text-slate-500">
                  <span>Trust weight {Math.round(persona.trustWeight * 100)}%</span>
                  <span>Initial trust {persona.initialTrust}</span>
                  <span>Tolerance {Math.round(persona.negotiationTolerance * 100)}%</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "timeline" && (
        <Card>
          <div className="space-y-3">
            {[...scenario.timeline]
              .sort((a, b) => a.roundNumber - b.roundNumber)
              .map((event) => (
                <div key={event.id} className="flex gap-4 border-b border-surface-border pb-3 last:border-none">
                  <div className="w-16 shrink-0 text-xs font-medium text-slate-500">Round {event.roundNumber}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{event.title}</span>
                      <Badge tone={event.kind === "CRISIS" ? "danger" : event.kind === "OPPORTUNITY" ? "success" : "default"}>{event.kind.replace("_", " ")}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">{event.description}</p>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}

      {tab === "json" && (
        <div className="space-y-3">
          <textarea
            value={jsonDraft}
            onChange={(e) => setJsonDraft(e.target.value)}
            rows={24}
            spellCheck={false}
            className="w-full rounded-md border border-surface-border bg-surface px-3 py-2 font-mono text-xs text-slate-200 outline-none focus:border-brand-500"
          />
          <button onClick={() => runAction(handleApplyJson)} disabled={busy} className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-500">
            Apply JSON changes
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-200">{value}</dd>
    </div>
  );
}

function ConditionList({ conditions }: { conditions: Scenario["winConditions"] }) {
  if (conditions.length === 0) return <p className="text-sm text-slate-500">None defined.</p>;
  return (
    <ul className="space-y-1 text-sm text-slate-300">
      {conditions.map((c, i) => (
        <li key={i}>
          {c.metric} {c.comparator === "gte" ? "≥" : "≤"} {c.target}
          {c.roundNumber ? ` (round ${c.roundNumber})` : " (final round)"}
        </li>
      ))}
    </ul>
  );
}
