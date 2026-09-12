import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SOCKET_EVENTS, type StudioGenerationCompletedPayload, type StudioGenerationFailedPayload, type StudioGenerationProgressPayload } from "@kldsim/shared";
import { api, ApiError } from "../lib/apiClient";
import { connectSocket } from "../lib/socketClient";
import { useSocketEvent } from "../hooks/useSocketEvent";
import { Card } from "../components/common/Card";

type Phase = "idle" | "queued" | "generating" | "validating" | "completed" | "failed";

const PHASE_LABEL: Record<Phase, string> = {
  idle: "",
  queued: "Queued for generation…",
  generating: "The configured AI provider is synthesizing the scenario…",
  validating: "Validating topology, personas, and timeline…",
  completed: "Scenario generated — opening in the editor…",
  failed: "Generation failed",
};

export default function StudioGeneratePage() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [industry, setIndustry] = useState("");
  const [totalRounds, setTotalRounds] = useState(8);
  const [difficulty, setDifficulty] = useState<"INTRODUCTORY" | "STANDARD" | "ADVANCED" | "EXECUTIVE">("STANDARD");
  const [phase, setPhase] = useState<Phase>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    connectSocket();
  }, []);

  useSocketEvent<StudioGenerationProgressPayload>(
    SOCKET_EVENTS.STUDIO_GENERATION_PROGRESS,
    (payload) => {
      if (payload.jobId !== jobId) return;
      setPhase(payload.status === "GENERATING" ? "generating" : "validating");
    },
    [jobId],
  );

  useSocketEvent<StudioGenerationCompletedPayload>(
    SOCKET_EVENTS.STUDIO_GENERATION_COMPLETED,
    (payload) => {
      if (payload.jobId !== jobId) return;
      setPhase("completed");
      setTimeout(() => navigate(`/studio/${payload.scenarioId}`), 600);
    },
    [jobId],
  );

  useSocketEvent<StudioGenerationFailedPayload>(
    SOCKET_EVENTS.STUDIO_GENERATION_FAILED,
    (payload) => {
      if (payload.jobId !== jobId) return;
      setPhase("failed");
      setError(payload.message);
    },
    [jobId],
  );

  async function handleSubmit() {
    setError(null);
    setPhase("queued");
    try {
      const data = await api.post<{ jobId: string }>("/api/scenarios/generate", {
        prompt,
        industry: industry || undefined,
        totalRounds,
        difficulty,
      });
      setJobId(data.jobId);
    } catch (err) {
      setPhase("failed");
      if (err instanceof ApiError && err.issues && err.issues.length > 0) {
        setError(err.issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join(" · "));
      } else {
        setError(err instanceof Error ? err.message : "Failed to queue generation");
      }
    }
  }

  const roundsValid = Number.isInteger(totalRounds) && totalRounds >= 3 && totalRounds <= 20;
  const busy = phase === "queued" || phase === "generating" || phase === "validating";

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold text-white">Generate a scenario</h1>
      <p className="mb-6 text-sm text-slate-400">
        Describe an industry, business challenge, or case study in plain text. The AI abstraction layer will synthesize a complete, validated
        scenario: narrative, baseline metrics, a 3D enterprise topology, stakeholder personas, and a round-by-round event timeline.
      </p>

      <Card>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Scenario description</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              disabled={busy}
              placeholder="A regional airline is modernizing its reservation and loyalty systems while an activist investor is pressuring the board to cut IT spend by 20%..."
              className="w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Industry (optional)</label>
              <input
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                disabled={busy}
                placeholder="Auto-detect"
                className="w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Rounds</label>
              <input
                type="number"
                min={3}
                max={20}
                value={Number.isNaN(totalRounds) ? "" : totalRounds}
                onChange={(e) => setTotalRounds(e.target.value === "" ? NaN : Number(e.target.value))}
                onBlur={() => setTotalRounds(Math.min(20, Math.max(3, Number.isNaN(totalRounds) ? 8 : Math.round(totalRounds))))}
                disabled={busy}
                className={`w-full rounded-md border bg-surface px-3 py-2 text-sm text-white outline-none focus:border-brand-500 ${
                  roundsValid ? "border-surface-border" : "border-health-critical/60"
                }`}
              />
              {!roundsValid && <p className="mt-1 text-xs text-health-critical">Must be 3–20</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
                disabled={busy}
                className="w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
              >
                <option value="INTRODUCTORY">Introductory</option>
                <option value="STANDARD">Standard</option>
                <option value="ADVANCED">Advanced</option>
                <option value="EXECUTIVE">Executive</option>
              </select>
            </div>
          </div>

          {phase !== "idle" && (
            <div className={`rounded-md border px-3 py-2 text-sm ${phase === "failed" ? "border-health-critical/40 text-health-critical" : "border-brand-500/40 text-brand-300"}`}>
              {PHASE_LABEL[phase]}
              {error && <div className="mt-1 text-xs opacity-80">{error}</div>}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={busy || prompt.trim().length < 20 || !roundsValid}
            className="w-full rounded-md bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-40"
          >
            {busy ? "Generating…" : "Generate scenario"}
          </button>
        </div>
      </Card>
    </div>
  );
}
