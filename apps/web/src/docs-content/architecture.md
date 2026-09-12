# System Architecture

KLD Sim is a multi-tenant SaaS platform for competitive enterprise-architecture
and business-strategy simulation. It is split into four decoupled subsystems
that communicate over a typed HTTP + WebSocket contract.

## Subsystems

**Simulation Engine** (`packages/shared/src/scoring`) — a pure, dependency-free
TypeScript module that turns a team's round decisions into next-round state.
It has no knowledge of HTTP, sockets, or the database: `resolveRound(input)`
is a deterministic function you can unit test with plain objects. This is
deliberate — the hardest bugs in a simulation platform are scoring bugs, and
pure functions are the only kind you can trust with a snapshot test.

**LLM Gateway** (`packages/llm-gateway`) — the "Bring Your Own AI" abstraction
layer. A `LLMProvider` interface (`generateText`, `streamText`, `healthCheck`)
is implemented once per provider (Ollama, Gemini, Claude, OpenAI) as a thin
wrapper over that provider's native HTTP API — no vendor SDKs, so the four
adapters are guaranteed to expose an identical surface. An `LLMGateway` wraps
an ordered list of providers and retries the next one on failure, so a
scenario-generation call degrades from "tenant's configured Claude key" to
"local Ollama" instead of hard-failing. A `jsonGuard` module wraps every
structured-output call in a validate-and-repair loop: if the model's JSON
fails the zod schema, the validation errors are fed back to the model as a
correction turn (up to a configurable number of attempts) before giving up.

**API server** (`apps/api`) — Express + Prisma + PostgreSQL for persistence,
Redis + BullMQ for background jobs (scenario generation, proposal scoring,
round-timer expiry all run as queued jobs, not inline in the request), and
Socket.IO (with the Redis adapter, so it scales horizontally) for everything
that needs to reach a browser without polling: round starts, decision
submissions, negotiation streaming, telemetry.

**Web client** (`apps/web`) — React + Vite. The 3D enterprise topology is a
real WebGL scene (react-three-fiber / three.js), not a canvas illustration —
every node's position, health color, and bottleneck pulse comes directly from
the same `TopologyGraph` JSON the engine mutates each round.

## Data flow for one round

1. Each team's UI holds a `Decision` (budget allocation + per-node engineering
   actions) locally, auto-saved as a draft via `PUT .../decision`.
2. On submit, the decision is locked (`POST .../decision/submit`) and a
   `DECISION_SUBMITTED` telemetry event fires to the facilitator's war room.
3. When the round timer expires (a BullMQ delayed job scheduled at round
   start) — or the facilitator forces it early — `resolveRoundForSession`
   loads every team's decision (or a neutral default if none was submitted),
   any scored negotiation outcomes from that round, and the scenario's
   authored timeline events, and calls the pure `resolveRound` engine once
   per team.
4. Results are persisted (`RoundResult`, updated `Team.metrics` /
   `Team.topology`), loss conditions are checked, the session's `currentRound`
   advances (or the session completes), and `ROUND_RESOLVED` /
   `TEAM_TOPOLOGY_UPDATED` / `SESSION_STATE` are broadcast over the session's
   and each team's Socket.IO room.

## Tenancy and identity

Every persisted row that matters is scoped by `tenantId`. A JWT access token
(15-minute default TTL) carries `{ userId, tenantId, role }`; a rotating
refresh token lives in an `httpOnly` cookie scoped to `/api/auth`. Socket.IO
connections authenticate the same access token during the handshake and are
only allowed to join a session/team room after a server-side membership
check — a player cannot subscribe to another team's negotiation channel by
guessing its id.

## Why JSON columns for scenario content

A scenario's topology, personas, timeline, and win/loss conditions are stored
as PostgreSQL `Json` columns rather than normalized tables. They are always
read and written as a whole document — by the engine, by the Game Studio
editor, by the LLM gateway's validator — and never queried by sub-field in
SQL. Normalizing them would add a dozen join tables and migration surface
area for zero query benefit; the zod schema in `packages/shared` is the real
source of structural truth, not the database schema.
