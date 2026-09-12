# Scoring & Simulation Mechanics

Every number on screen comes from `packages/shared/src/scoring/engine.ts` — a
pure function, `resolveRound`, with no randomness. The same inputs always
produce the same outputs, which is what makes the debrief replay exact and
the engine unit-testable with plain assertions instead of statistical
tolerance.

## The four metrics

| Metric | Range | Direction |
|---|---|---|
| Total Cost of Ownership (`tco`) | cumulative, unbounded | lower is better |
| Technical Debt Index (`technicalDebtIndex`) | 0-100 | lower is better |
| Delivery Velocity (`deliveryVelocity`) | 0-100 | higher is better |
| Stakeholder Trust (`stakeholderTrust`) | 0-100 | higher is better |

## Two independent levers, on purpose

A team acts on the enterprise through two mechanisms with deliberately
different scope:

- **Budget allocation** (`modernization`, `newFeatures`, `riskMitigation`,
  `stakeholderEngagement` — fractions summing to 1.0) is strategic: it moves
  the enterprise-wide index directly, every round, regardless of which
  systems it "really" affects.
- **Per-node engineering actions** (`MODERNIZE` / `PATCH` / `DECOMMISSION` /
  `IGNORE`) are surgical: they change that one node's debt load and health
  instantly and visibly in the 3D view, and their *aggregate* effect on the
  enterprise-wide debt index is the total debt reduced across acted-upon
  nodes, averaged over the whole node count — so fixing one bad node in a
  40-node enterprise moves the index a little; fixing it in a 6-node one
  moves it a lot.

Neither lever alone is sufficient to win — allocation without node actions
never resolves specific bottlenecks; node actions without allocation never
move velocity or trust.

## Technical Debt Index

```
technicalDebtIndex' = clamp0-100(
    technicalDebtIndex
  − modernization × 28        // debt paydown rate
  + newFeatures    × 14        // debt accrued by shipping features without paying debt down
  + 3                          // natural drift — debt accrues even if you do nothing
  + nodeDrivenDelta             // −(total debt reduced by node actions this round) / node count
  + eventImpact.technicalDebtIndex
)
```

## Delivery Velocity

```
deliveryVelocity' = clamp0-100(
    deliveryVelocity
  + newFeatures    × 22        // velocity gained from shipping features
  + modernization  × 9         // velocity gained from unblocking throughput
  − technicalDebtIndex × 0.18  // debt drags velocity — measured on the PRE-round debt level
  + eventImpact.deliveryVelocity
)
```

## Total Cost of Ownership

```
tco' = tco + roundBudget × (1 + technicalDebtIndex × 0.012) + eventImpact.tco
```

A debt-laden enterprise pays more for the same nominal budget — at
`technicalDebtIndex = 100` the multiplier is 2.2×. This is deliberately
modeled as *inefficiency*, not as a separate spend category: firefighting a
fragile system costs more than the same feature would on a clean one.

## Stakeholder Trust

```
stakeholderTrust' = clamp0-100(
    stakeholderTrust
  + stakeholderEngagement × 18
  + riskMitigation        × 10
  + negotiationContribution     // mean(scored proposal trustDeltas this round) × 0.6
  − 15                          // only if a CRISIS event fires this round AND riskMitigation < 15%
  + eventImpact.stakeholderTrust
)
```

Every **formal proposal** a team submits to a persona is scored by the
configured AI provider on empathy, financial acumen, and strategic
alignment, filtered through that persona's own biases and hidden agenda, and
returns a signed `trustDelta` (−100..100). All such deltas resolved during a
round feed into that round's stakeholder-trust update above; free-form chat
never does.

## Composite score (debrief leaderboard)

```
tcoEfficiency = clamp0-100(100 − (tco / budgetEnvelope) × 100)
budgetEnvelope = roundBudget × totalRounds × 1.5

composite = (100 − technicalDebtIndex) × 0.25
          +  deliveryVelocity          × 0.30
          +  stakeholderTrust          × 0.25
          +  tcoEfficiency             × 0.20
```

## Win and loss conditions

A scenario defines both as a list of `{ metric, comparator, target,
roundNumber? }`. Conditions with an explicit `roundNumber` are checked only
on that round; conditions without one are checked at the final round for
**win** conditions, but **every round** for **loss** conditions — a team can
be eliminated the moment stakeholder trust collapses rather than only at the
end of the game.

## Node health thresholds

A node's `debtLoad` (0-100) maps to a health band: `< 25` Healthy, `< 50` At
Risk, `< 75` Degraded, `≥ 75` Critical — the same thresholds drive both the
3D view's node color and its `isBottleneck` flag (`debtLoad ≥ 70`). A node no
action was submitted for drifts up by 1 point (organizational entropy); one
explicitly set to `IGNORE` drifts by 4 — a conscious deferral costs more
than an oversight.
