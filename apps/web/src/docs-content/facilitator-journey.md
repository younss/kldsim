# Facilitator Journey

## 1. Get (or build) a scenario

You need a **published** scenario before you can run a session. Either pick
one from the **Game Studio** library, or generate a new one: describe the
industry and challenge in plain text, and the configured AI provider
synthesizes a complete scenario — narrative, baseline metrics, a topology
graph, 2-8 stakeholder personas, and a round-by-round event timeline — as
structured JSON validated against a strict schema (dangling edge references,
personas whose trust weights don't sum to 1, timeline events scheduled past
the last round, and similar structural mistakes are rejected and the model is
asked to correct them automatically before you ever see the result).

Open the generated draft in the editor: read the narrative, check the 3D
topology preview, review each persona's stated goals and hidden agenda, skim
the timeline. Tweak anything — the structured tabs cover the common edits, or
drop into the **Raw JSON** tab for anything they don't. Click **Validate**;
once it passes, **Publish**. Published scenarios are immutable (archive and
duplicate instead of editing in place), so sessions already running against
one can't have the ground shift under them.

## 2. Create and staff a session

From **Sessions**, pick a published scenario and a round length, and create
a session — it starts in the **lobby**. Add teams and assign players from
your tenant's roster (invite new player accounts from tenant settings if you
need to). Players see their team the moment you add them.

## 3. Start it

**Start session** moves everyone out of the lobby simultaneously and starts
round 1's timer. From here you're in the **war room**.

## 4. Run the war room

The war room is built to be watched, not read once:

- **Per-team status** — who's submitted this round's decision and who
  hasn't, plus that team's live metrics.
- **Live telemetry feed** — every decision submission, negotiation outcome,
  round resolution, and injected event, as it happens.
- **Timer controls** — pause (freezes the countdown and reschedules it
  correctly on resume, it doesn't just stop the clock and forget), extend by
  five minutes, or force the round to resolve immediately regardless of the
  clock.
- **Inject an event** — apply an immediate, deterministic metric shock to
  every active team, independent of anything scripted in the scenario's
  timeline. Use this for the moment nobody wrote into the scenario but the
  room needs anyway.
- **Broadcast** — a message every participant sees immediately, for
  announcements that aren't a scored simulation event.

## 5. Debrief

Once the final round resolves — or every team has been eliminated by a loss
condition — the session completes automatically and everyone (including you)
lands on the debrief: composite leaderboard, radar comparison, full replay.
Use it live as a facilitated discussion, or export the story from the replay
afterward.

## Facilitator vs. player visibility

You can open any team's negotiation history and decision status for
oversight, but you cannot submit a decision or a proposal on a team's
behalf from the war room by design — the simulation's integrity depends on
each team's choices being their own.
