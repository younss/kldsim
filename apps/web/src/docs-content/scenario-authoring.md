# Scenario Authoring Manual

## Writing a good generation prompt

The Game Studio's generator turns a plain-text description into a complete
scenario. It works best with a prompt that gives it real tension to work
with, not just an industry label:

> Weak: *"A bank modernizing its systems."*
>
> Strong: *"A 40-year-old regional bank whose core ledger runs on a 1990s
> mainframe is losing deposits to neobanks with instant onboarding, while an
> activist investor is pressuring the board to cut IT opex 20% this year.
> The CFO wants predictable costs, the head of retail banking wants
> competitive mobile features shipped now, and the delivery lead has been
> quietly bypassing the ledger's API to hit deadlines."*

The stronger prompt gives the model concrete stakeholder tension (cost vs.
speed vs. risk), a reason the enterprise is already under strain, and a
hidden problem (the bypassed API) a hidden-agenda persona can be built
around. You can also set an industry hint, target round count (3-20), and a
difficulty label, which shapes how forgiving the baseline metrics and
win/loss thresholds are.

## What gets generated

| Field | Contents |
|---|---|
| `narrative`, `objectives` | The framing text and stated goals shown to players |
| `winConditions` / `lossConditions` | `{ metric, comparator, target, roundNumber? }` — see [Scoring & Simulation Mechanics](/docs/scoring-formulas) |
| `baselineMetrics` | Starting TCO/debt/velocity/trust |
| `topology` | 8-24 nodes (capabilities, applications, data stores, integrations, an external partner) with dependency/data-flow/API-call edges |
| `personas` | 2-8 stakeholders, each with stated goals, a hidden agenda, biases, negotiation tolerance, and a trust weight |
| `timeline` | Scripted market disruptions, audits, crises, and opportunities, one or more per round |

Every generation is validated against the same zod schema the API enforces
at every other entry point — including referential integrity checks a plain
JSON-schema can't express: every edge must reference a real node id, every
timeline event's round must fall within `totalRounds`, persona `trustWeight`
values must sum to ~1.0, and every id must be unique. If the model's output
fails any of these, the failure is fed back to it as a correction request
automatically (up to a few attempts) before you ever see a result — you
should rarely see a raw validation failure, but if you do, it means the
model couldn't fix it after several tries and the prompt likely needs to be
more specific.

## Editing a draft

The editor has five views:

- **Overview** — narrative, objectives, parameters, win/loss conditions.
- **Topology** — a live 3D preview plus a flat node list (kind, debt,
  bottleneck flag).
- **Personas** — stated goals, archetype, trust weight, initial trust,
  negotiation tolerance. Hidden agendas are shown here too (you're the
  author — players never see them directly).
- **Timeline** — every scripted event grouped by round.
- **Raw JSON** — the complete scenario document, editable directly and
  applied as a single PATCH. Use this for anything the structured views
  don't expose, or to paste in a hand-authored scenario wholesale.

Editing any field moves a scenario back to `DRAFT` even if it was previously
`VALIDATED` — re-run **Validate** before publishing.

## Publishing lifecycle

`DRAFT → VALIDATED → PUBLISHED → ARCHIVED`. Only a `VALIDATED` scenario can
be published, and a `PUBLISHED` scenario is immutable — sessions already
running against it can't have its rules change mid-game. To revise a
published scenario, archive it and start a new draft (the Raw JSON tab makes
copying its content into a fresh scenario quick).

## Designing win/loss conditions deliberately

A scenario with no loss conditions never eliminates a struggling team, which
can be exactly what you want for an introductory session — nobody is cut
from the room. Add a `stakeholderTrust ≤ 8` (or similar) loss condition for
a higher-stakes session where consequences should be real and immediate
rather than only scored at the end.
