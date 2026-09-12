# API Reference & Provider Guide

All endpoints are under `/api`. Authenticate with `Authorization: Bearer
<accessToken>`; the access token comes from `/api/auth/login` and expires
after 15 minutes, refreshed via `/api/auth/refresh` using the `httpOnly`
refresh cookie it also sets. Realtime updates arrive over Socket.IO at the
same origin (`path: /socket.io`), authenticated by passing the access token
in the connection handshake's `auth.token`.

## Core endpoints by area

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me` |
| Tenant | `GET/POST /tenants/users` |
| Providers | `GET/POST /providers`, `PUT/DELETE /providers/:id`, `POST /providers/:id/health-check` |
| Game Studio | `POST /scenarios/generate` (returns a job id), `GET /scenarios/generate/:jobId`, `GET/POST /scenarios`, `GET/PATCH/DELETE /scenarios/:id`, `POST /scenarios/:id/{validate,publish,archive}` |
| Sessions | `GET/POST /sessions`, `GET /sessions/mine`, `GET /sessions/:id`, `POST /sessions/:id/{start,pause,resume,round/force-end,events/inject,broadcast}`, `POST /sessions/:id/timer/extend`, `GET /sessions/:id/{war-room,debrief}` |
| Teams | `GET/POST /sessions/:id/teams`, `GET /sessions/:id/teams/me`, `GET/DELETE /sessions/:id/teams/:teamId` |
| Decisions | `GET/PUT /sessions/:id/teams/:teamId/rounds/:round/decision`, `POST .../decision/submit` |
| Negotiations | `GET /sessions/:id/teams/:teamId/negotiations/:personaId/messages`, `POST .../proposals` (returns a job id; the scored reply arrives over the socket) |

Scenario generation and proposal scoring are both **asynchronous** — the
route returns a `jobId` (BullMQ) immediately (HTTP 202) and the result
arrives over the socket (`studio:generation:completed` /
`negotiation:proposal:evaluated`) once the configured AI provider responds.
This is deliberate: an LLM call can take anywhere from one to tens of
seconds, and nothing about the platform should block a request thread on
that.

## Socket events

| Event | Direction | Payload |
|---|---|---|
| `join:session` / `join:team` | client → server | `{ sessionId }` / `{ sessionId, teamId }` |
| `session:state` | server → room | full session + teams snapshot |
| `round:started` / `round:resolved` | server → session room | round number (+ results on resolve) |
| `decision:submitted` | server → session room | `{ teamId, roundNumber }` (no content — facilitator sees status, not answers) |
| `team:topology:updated` | server → team room | fresh topology + metrics for that team only |
| `negotiation:send` | client → server | `{ sessionId, teamId, personaId, content }` — free-form chat |
| `negotiation:message` / `negotiation:stream:chunk` / `negotiation:stream:done` | server → team room | chat transcript + token stream |
| `negotiation:proposal:evaluated` | server → team room | scored reply + trust delta |
| `telemetry:event` / `facilitator:override` | server → session room | war-room feed |

## Connecting an AI provider

`POST /api/providers` with:

```json
{
  "provider": "CLAUDE",
  "model": "claude-sonnet-5",
  "apiKey": "sk-ant-...",
  "isDefault": true
}
```

`provider` is one of `OLLAMA | GEMINI | CLAUDE | OPENAI`. `baseUrl` is only
meaningful for `OLLAMA` (defaults to the `ollama` container's address) or to
point at a self-hosted / proxy endpoint for another provider. `apiKey` is
encrypted at rest and never echoed back — list/get responses return
`configured: boolean` instead. The response never differs by provider beyond
that: every provider implements the exact same `generateText` / `streamText`
/ `healthCheck` contract, so nothing in the business logic branches on which
one is active.

### Provider-specific notes

- **Ollama** — no API key. Talks to `/api/chat` (`format: "json"` for
  structured output, `stream: true` for token streaming). This is the
  always-available fallback: if every configured cloud provider fails, the
  gateway falls back to it automatically even if you never explicitly add a
  config row for it.
- **OpenAI** — `/v1/chat/completions`, `response_format: {type:
  "json_object"}` for structured output.
- **Claude** — `/v1/messages`; system messages are hoisted out of the
  message array into the top-level `system` field per Anthropic's API shape.
- **Gemini** — `generateContent` / `streamGenerateContent?alt=sse`; roles are
  remapped to Google's `user` / `model` vocabulary and the API key is passed
  as a query parameter rather than a header.

## Error shape

Every error response is `{ "error": { "code": string, "message": string,
"issues"?: [...] } }`. `issues` is present for `VALIDATION_ERROR` (zod) and
lists `{ path, message }` per failed field. LLM-specific failures surface as
`LLM_VALIDATION_FAILED` (schema-valid JSON never obtained after retries) or
`ALL_PROVIDERS_FAILED` (every provider in the tenant's fallback chain
errored, with a per-provider `attempts` breakdown).
