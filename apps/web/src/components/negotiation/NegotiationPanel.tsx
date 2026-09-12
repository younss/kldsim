import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  SOCKET_EVENTS,
  type NegotiationMessage,
  type NegotiationProposalEvaluatedPayload,
  type NegotiationStreamDonePayload,
  type StakeholderPersona,
} from "@kldsim/shared";
import { api } from "../../lib/apiClient";
import { getSocket } from "../../lib/socketClient";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { Card } from "../common/Card";
import { Badge } from "../common/Badge";

export function NegotiationPanel({ sessionId, teamId, personas }: { sessionId: string; teamId: string; personas: StakeholderPersona[] }) {
  const [selectedId, setSelectedId] = useState(personas[0]?.id ?? "");
  const [mode, setMode] = useState<"chat" | "proposal">("chat");
  const [messages, setMessages] = useState<NegotiationMessage[]>([]);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [proposalStatus, setProposalStatus] = useState<"idle" | "pending">("idle");
  const [lastEvaluation, setLastEvaluation] = useState<NegotiationProposalEvaluatedPayload | null>(null);

  const selectedPersona = useMemo(() => personas.find((p) => p.id === selectedId), [personas, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    setMessages([]);
    setStreamingText(null);
    api
      .get<{ messages: NegotiationMessage[] }>(`/api/sessions/${sessionId}/teams/${teamId}/negotiations/${selectedId}/messages`)
      .then((data) => setMessages(data.messages));
  }, [sessionId, teamId, selectedId]);

  useSocketEvent<NegotiationMessage>(
    SOCKET_EVENTS.NEGOTIATION_MESSAGE,
    (message) => {
      if (message.teamId !== teamId || message.personaId !== selectedId) return;
      setMessages((prev) => [...prev, message]);
    },
    [teamId, selectedId],
  );

  useSocketEvent<{ teamId: string; personaId: string; delta: string }>(
    SOCKET_EVENTS.NEGOTIATION_STREAM_CHUNK,
    (payload) => {
      if (payload.teamId !== teamId || payload.personaId !== selectedId) return;
      setStreamingText((prev) => (prev ?? "") + payload.delta);
    },
    [teamId, selectedId],
  );

  useSocketEvent<NegotiationStreamDonePayload>(
    SOCKET_EVENTS.NEGOTIATION_STREAM_DONE,
    (payload) => {
      if (payload.teamId !== teamId || payload.personaId !== selectedId) return;
      setStreamingText(null);
      setMessages((prev) => [...prev, payload.message]);
    },
    [teamId, selectedId],
  );

  useSocketEvent<NegotiationProposalEvaluatedPayload>(
    SOCKET_EVENTS.NEGOTIATION_PROPOSAL_EVALUATED,
    (payload) => {
      if (payload.teamId !== teamId || payload.personaId !== selectedId) return;
      setMessages((prev) => [...prev, payload.message]);
      setLastEvaluation(payload);
      setProposalStatus("idle");
    },
    [teamId, selectedId],
  );

  function sendChat() {
    if (!input.trim() || !selectedId) return;
    getSocket().emit(SOCKET_EVENTS.SEND_NEGOTIATION_MESSAGE, { sessionId, teamId, personaId: selectedId, content: input });
    setInput("");
  }

  async function sendProposal() {
    if (!input.trim() || !selectedId) return;
    setProposalStatus("pending");
    setLastEvaluation(null);
    try {
      await api.post(`/api/sessions/${sessionId}/teams/${teamId}/negotiations/${selectedId}/proposals`, { content: input });
      setInput("");
    } catch {
      setProposalStatus("idle");
    }
  }

  return (
    <Card className="flex h-[560px] flex-col">
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {personas.map((persona) => (
          <button
            key={persona.id}
            onClick={() => setSelectedId(persona.id)}
            className={clsx(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs",
              persona.id === selectedId ? "border-brand-500 bg-brand-500/15 text-brand-300" : "border-surface-border text-slate-400 hover:bg-white/5",
            )}
          >
            {persona.name}
          </button>
        ))}
      </div>

      {selectedPersona && (
        <div className="mb-2 rounded-md border border-surface-border bg-surface px-3 py-2 text-xs text-slate-400">
          <span className="font-medium text-slate-200">{selectedPersona.role}</span> · {selectedPersona.statedGoals[0]}
        </div>
      )}

      <div className="mb-3 flex-1 space-y-2 overflow-y-auto scrollbar-thin pr-1">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} personaName={selectedPersona?.name ?? "Persona"} />
        ))}
        {streamingText !== null && (
          <div className="max-w-[85%] rounded-lg rounded-tl-none bg-white/5 px-3 py-2 text-sm text-slate-200">
            {streamingText}
            <span className="animate-pulse">▍</span>
          </div>
        )}
        {lastEvaluation && (
          <div className="rounded-md border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-xs text-brand-300">
            Trust {lastEvaluation.trustDelta >= 0 ? "+" : ""}
            {Math.round(lastEvaluation.trustDelta)} → now {Math.round(lastEvaluation.newTrust)}/100
          </div>
        )}
      </div>

      <div className="mb-2 flex gap-1 text-xs">
        <button
          onClick={() => setMode("chat")}
          className={clsx("rounded-md px-2 py-1", mode === "chat" ? "bg-white/10 text-white" : "text-slate-500")}
        >
          Chat
        </button>
        <button
          onClick={() => setMode("proposal")}
          className={clsx("rounded-md px-2 py-1", mode === "proposal" ? "bg-white/10 text-white" : "text-slate-500")}
        >
          Formal proposal (scored)
        </button>
      </div>

      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={2}
          placeholder={mode === "chat" ? "Say something in character…" : "Describe your formal proposal — scored on empathy, financial acumen, and alignment"}
          className="flex-1 resize-none rounded-md border border-surface-border bg-surface px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
        />
        <button
          onClick={mode === "chat" ? sendChat : sendProposal}
          disabled={mode === "proposal" && proposalStatus === "pending"}
          className="rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-40"
        >
          {mode === "proposal" && proposalStatus === "pending" ? "Scoring…" : "Send"}
        </button>
      </div>
    </Card>
  );
}

function MessageBubble({ message, personaName }: { message: NegotiationMessage; personaName: string }) {
  const isPersona = message.speaker === "PERSONA";
  return (
    <div className={clsx("flex flex-col", isPersona ? "items-start" : "items-end")}>
      <div className={clsx("max-w-[85%] rounded-lg px-3 py-2 text-sm", isPersona ? "rounded-tl-none bg-white/5 text-slate-200" : "rounded-tr-none bg-brand-600/30 text-white")}>
        {message.content}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 px-1 text-[10px] text-slate-500">
        <span>{isPersona ? personaName : "You"}</span>
        {message.trustDelta != null && <Badge tone={message.trustDelta >= 0 ? "success" : "danger"}>{message.trustDelta >= 0 ? "+" : ""}{Math.round(message.trustDelta)} trust</Badge>}
      </div>
    </div>
  );
}
