# Player Journey

## 1. Sign in and find your session

Your facilitator creates a tenant account for your organization (or invites
you into an existing one) and gives you a login. Sign in at `/login`. The
**Sessions** page lists every session you're part of — either because a
facilitator already assigned you to a team, or because you're facilitating
one yourself.

## 2. The lobby

Before a session starts you'll see the **lobby**: the scenario title, the
teams registered so far, and who's on each. You can't act yet — this is
where the facilitator assembles teams. The moment the facilitator clicks
**Start session**, everyone in the lobby is redirected automatically (no
refresh needed) to the live game.

## 3. Reading your enterprise

The play screen has three things running at once:

- **The four headline metrics** — Total Cost of Ownership, Technical Debt
  Index, Delivery Velocity, Stakeholder Trust — each colored by how healthy
  it currently is, not by which metric it is.
- **The 3D topology** — your enterprise's capabilities, applications, data
  stores, integrations, and external partners, laid out in space. Node color
  is health (green→red), node shape is kind (a cube is an application, a
  cylinder is a data store, and so on), and a pulsing halo marks a
  bottleneck. Drag to orbit, scroll to zoom, click a node to select it — the
  same click also focuses that node in the decision form below.
- **The negotiation panel** — a live chat with each of the scenario's
  stakeholder personas.

## 4. Making a decision, every round

Each round you submit one **Decision**:

- **Budget allocation** across four levers — modernization, new features,
  risk mitigation, stakeholder engagement — that must sum to 100%. This is
  the strategic lever: it moves the enterprise-wide index directly.
- **Per-node engineering actions** — for any node you want to touch this
  round, choose Modernize (full debt paydown, expensive), Patch (partial,
  cheap), Decommission (removes the node's debt entirely), or leave it on
  Ignore. This is the surgical lever: it's visible immediately on that one
  node and contributes a smaller, averaged effect to the enterprise index.
  A node nobody touches still drifts — technology rot doesn't wait for you.
- **Rationale** — a short note the facilitator sees in the debrief replay.

You can **save a draft** as many times as you like. **Submitting** locks the
decision for the round — there's no take-back once it's in, just like a real
budget cycle.

## 5. Negotiating with stakeholders

Two different things happen in the negotiation panel, and they're not the
same action:

- **Chat** is free-form, in-character roleplay. It never moves a metric —
  it's where you build context, probe a persona's priorities, or just talk
  them down. Replies stream in token-by-token.
- **Formal proposal** is a scored action. Write out what you're actually
  proposing and submit it; a few seconds later the persona replies in
  character *and* you see a trust delta — that persona privately scored your
  proposal on empathy, financial acumen, and strategic alignment, filtered
  through their own biases and hidden agenda (which you're never shown
  directly — you have to infer it from how they react over time). Trust
  deltas from proposals resolved during a round feed into that round's
  stakeholder-trust calculation alongside your budget allocation.

## 6. When the round ends

A round ends when the timer runs out or the facilitator forces it early.
Everyone's decisions resolve simultaneously — you'll see a banner, then your
metrics, topology, and the timer reset for the new round. If a scripted
event (a market disruption, an audit, a crisis) was scheduled for that round,
its effects are folded into the same resolution.

## 7. Debrief

When the final round resolves (or your team's stakeholder trust collapses
entirely — a loss condition, not just a bad quarter), you're moved to the
**debrief**: a composite-score leaderboard, a radar chart comparing every
team across debt health, velocity, trust, and cost efficiency, and a full
round-by-round replay of what happened.
