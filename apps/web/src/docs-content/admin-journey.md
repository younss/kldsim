# Platform Administrator Journey

The first account created when a tenant registers is a **Platform Admin**.
Admins do everything a facilitator can, plus tenant-level configuration.

## Inviting users

From tenant settings, invite a user by email with a role (`FACILITATOR` or
`PLAYER` — admins can't be invited directly, only created via registration).
Since KLD Sim is self-hosted with no mail server assumed, invitation returns
a **temporary password** in the response for you to hand to that person
out-of-band; encourage them to change it on first login.

## Connecting AI providers — "Bring Your Own AI"

Out of the box, every tenant already has a working local provider: a
dedicated Ollama container running a lightweight model (`gemma3:4b` by
default), zero configuration required. This is what generates scenarios and
runs stakeholder negotiations if you never touch provider settings.

To use a stronger hosted model instead, add a provider configuration:

1. Pick a provider — Gemini, Claude, or OpenAI.
2. Enter the model id (e.g. `claude-sonnet-5`, `gemini-2.0-flash`, `gpt-4.1`).
3. Paste the API key. It is **encrypted at rest** with AES-256-GCM using a
   per-installation master key (`MASTER_ENCRYPTION_KEY`, set once at deploy
   time and never stored in the database) — the raw key is never returned to
   the browser again, only a `configured: true/false` flag.
4. Optionally mark it **default**. The gateway tries your default provider
   first, then falls back through your other enabled providers, and finally
   to the local Ollama instance if every configured provider fails or none
   are configured — a scenario-generation request degrades gracefully
   instead of hard-failing when a provider is rate-limited or misconfigured.

Use **Test connection** to run a live health check against a provider
without spending a generation call on it.

## Choosing what runs where

Every AI-backed action in the platform — scenario generation, persona chat,
proposal scoring — goes through the same gateway and therefore respects the
same provider chain uniformly. There's no per-feature provider selection to
manage separately; if you want a specific team's session to force a
particular provider for a one-off scenario generation, the Game Studio's
generation form exposes a provider override for that single request.

## Data and tenancy boundaries

Every scenario, session, team, decision, and provider configuration is
scoped to your tenant. There is no cross-tenant visibility at any role level
— a platform admin sees and manages only their own organization's data.
