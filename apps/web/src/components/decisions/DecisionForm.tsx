import { useMemo, useState } from "react";
import type { BudgetAllocation, NodeAction, TopologyGraph } from "@kldsim/shared";
import { ALLOCATION_KEYS } from "@kldsim/shared";
import { Card, CardHeader } from "../common/Card";

const ALLOCATION_LABELS: Record<keyof BudgetAllocation, string> = {
  modernization: "Modernization",
  newFeatures: "New features",
  riskMitigation: "Risk mitigation",
  stakeholderEngagement: "Stakeholder engagement",
};

const NODE_ACTIONS: NodeAction["action"][] = ["IGNORE", "PATCH", "MODERNIZE", "DECOMMISSION"];

interface DecisionFormProps {
  topology: TopologyGraph;
  selectedNodeId?: string;
  onSelectNode: (id: string) => void;
  locked: boolean;
  initialAllocation?: BudgetAllocation;
  initialNodeActions?: NodeAction[];
  onSubmit: (allocation: BudgetAllocation, nodeActions: NodeAction[], rationale: string) => Promise<void>;
  onSaveDraft: (allocation: BudgetAllocation, nodeActions: NodeAction[], rationale: string) => Promise<void>;
}

export function DecisionForm({
  topology,
  selectedNodeId,
  onSelectNode,
  locked,
  initialAllocation,
  initialNodeActions,
  onSubmit,
  onSaveDraft,
}: DecisionFormProps) {
  const [allocation, setAllocation] = useState<BudgetAllocation>(
    initialAllocation ?? { modernization: 25, newFeatures: 25, riskMitigation: 25, stakeholderEngagement: 25 },
  );
  const [nodeActions, setNodeActions] = useState<Map<string, NodeAction["action"]>>(
    new Map((initialNodeActions ?? []).map((a) => [a.nodeId, a.action])),
  );
  const [rationale, setRationale] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const total = ALLOCATION_KEYS.reduce((sum, key) => sum + allocation[key], 0);
  const valid = Math.abs(total - 100) < 0.5;

  function updateAllocation(key: keyof BudgetAllocation, value: number) {
    setAllocation((prev) => ({ ...prev, [key]: Math.max(0, Math.min(100, value)) }));
  }

  function toFraction(a: BudgetAllocation): BudgetAllocation {
    return {
      modernization: a.modernization / 100,
      newFeatures: a.newFeatures / 100,
      riskMitigation: a.riskMitigation / 100,
      stakeholderEngagement: a.stakeholderEngagement / 100,
    };
  }

  const nodeActionsArray = useMemo<NodeAction[]>(
    () => Array.from(nodeActions.entries()).map(([nodeId, action]) => ({ nodeId, action })),
    [nodeActions],
  );

  async function handleSaveDraft() {
    await onSaveDraft(toFraction(allocation), nodeActionsArray, rationale);
    setSavedAt(Date.now());
  }

  async function handleSubmit() {
    if (!valid) return;
    setSubmitting(true);
    try {
      await onSubmit(toFraction(allocation), nodeActionsArray, rationale);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Budget allocation" subtitle={`Total: ${total}% ${valid ? "" : "— must equal 100%"}`} />
        <div className="space-y-3">
          {ALLOCATION_KEYS.map((key) => (
            <div key={key}>
              <div className="mb-1 flex justify-between text-xs text-slate-400">
                <span>{ALLOCATION_LABELS[key]}</span>
                <span className="tabular-nums text-slate-300">{allocation[key]}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={allocation[key]}
                disabled={locked}
                onChange={(e) => updateAllocation(key, Number(e.target.value))}
                className="w-full accent-brand-500"
              />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Engineering actions" subtitle={selectedNodeId ? "Selected node highlighted below" : "Click a node in the 3D view to focus it"} />
        <div className="max-h-64 space-y-1.5 overflow-y-auto scrollbar-thin pr-1">
          {topology.nodes.map((node) => (
            <div
              key={node.id}
              onClick={() => onSelectNode(node.id)}
              className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-xs ${
                node.id === selectedNodeId ? "border-brand-500 bg-brand-500/10" : "border-surface-border hover:bg-white/5"
              }`}
            >
              <div>
                <div className="text-slate-200">{node.label}</div>
                <div className="text-slate-500">debt {node.debtLoad} · {node.health.replace("_", " ").toLowerCase()}</div>
              </div>
              <select
                value={nodeActions.get(node.id) ?? "IGNORE"}
                disabled={locked}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setNodeActions((prev) => new Map(prev).set(node.id, e.target.value as NodeAction["action"]))}
                className="rounded border border-surface-border bg-surface px-2 py-1 text-[11px] text-slate-200"
              >
                {NODE_ACTIONS.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Rationale" subtitle="Shown to the facilitator during debrief" />
        <textarea
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          disabled={locked}
          rows={3}
          placeholder="Why this allocation this round?"
          className="w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
        />
      </Card>

      {locked ? (
        <div className="rounded-md border border-health-healthy/30 bg-health-healthy/10 px-3 py-2 text-center text-sm text-health-healthy">
          Decision submitted for this round — locked until resolution.
        </div>
      ) : (
        <div className="flex gap-2">
          <button onClick={handleSaveDraft} className="flex-1 rounded-md border border-surface-border py-2 text-sm text-slate-200 hover:bg-white/5">
            Save draft {savedAt && <span className="text-slate-500">✓</span>}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!valid || submitting}
            className="flex-1 rounded-md bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-40"
          >
            {submitting ? "Submitting…" : "Submit decision"}
          </button>
        </div>
      )}
    </div>
  );
}
