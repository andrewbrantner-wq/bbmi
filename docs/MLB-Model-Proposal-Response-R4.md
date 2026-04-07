# Response to Director's Conditional Approval — MLB Model Proposal

**Date:** 2026-03-30
**Re:** Director's final four items before Phase 1b gate approval

---

Conditional approval received. Four items to resolve before Phase 1b begins. All four are addressed below with binding language. Phase 1a starts today.

---

## 1. Phase 1b Gate: Three-Outcome MVM Decision

**Director's critique:** The binary gate (above/below 52.38%) has no middle case. A result of 52.8% — above break-even but below the 53.5% launch threshold — has no defined decision process and will get rationalized.

**Resolution: Three-outcome gate adopted.**

**Revised Phase 1b MVM Gate:**

| MVM Result (best product ATS%) | Outcome | Decision Process |
|-------------------------------|---------|-----------------|
| **>= 53.5%** | **Strong signal** | Proceed to Phase 1c. The pitcher signal alone clears viability. Phase 1c is about confirming robustness and testing whether components add marginal value — not about finding an edge that doesn't yet exist. |
| **52.38% to 53.49%** | **Weak signal** | Proceed to Phase 1c **under constraint.** The pitcher signal exists but is insufficient alone. Written acknowledgment filed: "MVM achieved X.X% ATS — below the 53.5% launch threshold by Y.Y pp. Phase 1c components must collectively close this gap. If Phase 1c fails to lift the best product above 53.5%, the project does not launch regardless of component-level improvement." Phase 1c gets a hard cap of 4 components added (not the full priority list). If 4 components can't close the gap, the remaining components won't either — stop and write the research report. |
| **< 52.38%** | **No signal** | Stop. The pitcher signal does not clear the efficiency bar in MLB's market. Write the research report documenting what was learned. No Phase 1c. |

**The middle case has teeth.** It doesn't just say "proceed cautiously" — it imposes a constraint (4-component cap) and a binding secondary gate (must reach 53.5% after Phase 1c or the project terminates). This prevents the slow escalation where each component adds 0.2 pp and the team convinces itself that components 8 through 15 will collectively close the gap.

**Why 4 components as the cap:** The first 4 components in the priority list represent the highest-expected-signal additions. If they can't collectively add ~1 pp to a model that's already near break-even, the remaining components are even less likely to move the needle. The optimization surface is flat — we learned this in NCAA.

**Binding Phase 1c component order (weak-signal path only):**

Components are added in this exact sequence, one at a time, each validated before the next is added. The 4-component cap means the first four in this sequence — not any four of the team's choosing at the time:

1. **Team offensive rating** (wRC+-based composite, two-layer park separation)
2. **Bullpen quality** (team bullpen FIP/xFIP, recent 30-day performance)
3. **Catcher framing** (binary tier: elite/average/poor from Savant framing runs)
4. **Weather** (temperature, wind, humidity — transferred from NCAA coefficients)

This order is not revisable. If a later component's data pipeline is ready before an earlier one, the earlier one is still added first. The sequence reflects expected marginal signal strength, not implementation convenience.

---

## 2. Doubleheader Game 2: Routed Through Opener Protocol

**Director's critique:** Point 26 (DH Game 2, marked closed via R2 response) and Point 14 (rest/travel removed, marked closed) are in tension. One says use a bullpen-depletion protocol for DH Game 2; the other says all rest/travel adjustments are removed from Phase 1.

**Resolution: Doubleheader Game 2 is routed through the opener protocol, not the rest/travel framework.**

The director's framing is correct: DH Game 2 is a structural pitching composition problem, not a fatigue/travel problem. The opener detection system already handles "the announced starter isn't throwing a normal complement of innings." DH Game 2 games share the same characteristics:

- Starter is often a spot-starter, long reliever, or minor league callup (same as opener/bulk games)
- Bullpen availability is constrained by Game 1 usage (same input as the bullpen fatigue component)
- The "probable pitcher" may be TBD or unfamiliar (same fallback needed)

**Implementation:**

1. **Detection:** Flag all DH Game 2 games automatically from schedule data (MLB Stats API provides doubleheader flags)
2. **Routing:** DH Game 2 games enter the opener detection pipeline:
   - If Game 2 starter is a known traditional starter with normal IP/start history: treat as normal game but reduce projected IP by 0.5 innings (managers shorten Game 2 starts to protect arms)
   - If Game 2 starter is a spot-starter or unknown: apply the full opener protocol (team bullpen-weighted FIP, reduced confidence)
3. **Bullpen adjustment:** If Game 1 box score is available before Game 2 projection runs (typically yes for split doubleheaders, no for traditional doubleheaders): incorporate Game 1 bullpen IP into the fatigue model for Game 2. If not available: apply a flat +0.2 run penalty to both teams' bullpen projections as a conservative estimate.
4. **Confidence:** All DH Game 2 games capped at **low confidence** (stricter than opener games which cap at medium, because DH Game 2 has both the starter uncertainty AND the bullpen depletion problem simultaneously).

**No new infrastructure required.** This uses the opener detection system (already built for Point 7) plus the DH flag from the schedule API. Point 14 (rest/travel removed) remains correctly closed — the DH Game 2 issue is a pitching composition problem handled by existing opener infrastructure, not a rest/travel adjustment.

**Updated closure status:**
- Point 14 (rest/travel): **Closed** — rest/travel adjustments remain removed from Phase 1
- Point 26 (DH Game 2): **Closed** — routed through opener protocol with low-confidence cap

---

## 3. Pre-Registered Consistency Floor: Tightened

**Director's critique:** The "> 52.0% ATS in both halves" criterion is too permissive. A model at 57% / 52.1% has a severe seasonal pattern and should not be deployed without investigation.

**Resolution: Floor raised to break-even with investigation trigger.**

**Revised Pre-Registered Condition 3:**

> **Consistent across both halves:** The product achieves >= **52.38%** ATS (break-even) in both the first half (April-June) and second half (July-September) of each test season independently.
>
> **Investigation trigger:** If either half falls below **53.0%** ATS while the overall result exceeds 53.5%, an automatic investigation is triggered before the go decision is finalized. The investigation must produce a written explanation of the seasonal pattern, including:
> - Is the pattern consistent across both test seasons (2024 and 2025)? If the pattern appears in one year but not the other, it's likely noise.
> - Is the pattern explained by a known mechanism (e.g., April small-sample regression, September roster expansion)? If yes, document whether the mechanism can be addressed in Phase 1c or is inherent to the model.
> - Does the weaker half show positive ROI net of juice? A half-season at 52.5% ATS is technically above break-even but may not survive juice + variance.
>
> The investigation does not automatically prevent launch — but it must be completed and documented before the go decision is made. The director reviews the investigation before approving launch.

**Updated Pre-Registered Criteria (all five, final version):**

> 1. At least one product achieves >= 53.5% ATS over the full 2024-2025 walk-forward
> 2. Net ROI >= +2.0% at recommended edge threshold, at best available odds
> 3. Both halves of each season achieve >= 52.38% ATS (break-even). Investigation trigger if either half < 53.0%.
> 4. Both test seasons (2024 and 2025) independently achieve >= 52.38% ATS (break-even)
> 5. High-confidence games achieve >= 55.0% ATS; confidence tiers show monotonic performance ordering
>
> If conditions 1, 2, 4, or 5 fail: no launch. Period.
> If condition 3 fails at the 52.38% floor: no launch.
> If condition 3 triggers investigation (either half < 53.0% but >= 52.38%): launch decision pending director review of the seasonal pattern investigation.

---

## 4. Copula Parameter: Conditional vs. Unconditional

**Director's critique:** The bivariate Test B specifies a Gaussian copula but doesn't specify how the correlation coefficient rho is estimated or whether it varies by game context. Likely it does — blowouts should show higher home-away correlation than close games due to leverage/mop-up dynamics.

**Resolution: Add conditional rho test to distribution study scope.**

**Added to Test B (joint distribution) as explicit subtest:**

**Test B.3: Copula parameter stability**

1. Estimate rho (Gaussian copula correlation) from the full 2023-2025 sample (unconditional)
2. Re-estimate rho within each of five margin quintiles:
   - Q1: Final margin 0-1 runs (close games)
   - Q2: Final margin 2-3 runs
   - Q3: Final margin 4-5 runs
   - Q4: Final margin 6-7 runs
   - Q5: Final margin 8+ runs (blowouts)
3. Test heterogeneity: if rho varies by more than 0.10 across quintiles AND the variation is statistically significant (chi-squared test on the quintile-specific estimates), rho is context-dependent.
4. **Decision:**
   - If homogeneous: use the unconditional rho estimate. Simpler model, adequate for the use case.
   - If heterogeneous: implement conditional rho as a function of projected total and/or projected margin. Specifically: `rho = rho_base + rho_slope x abs(projected_margin)`. This captures the pattern that blowout-projected games (large expected margin) have higher correlation.
5. **F5 test:** Separately estimate rho for F5 outcomes. If F5 rho is not significantly different from zero (which we expect), document this as additional evidence that the independence assumption holds for F5 products and the bivariate model is only needed for full-game.

**Write the answer into the Phase 1a analytical report.** The copula parameter decision is made during the distribution study, not deferred to Phase 1b.

---

## Updated Phase 1a Parallel Workstreams

Per the director's authorization, starting today:

**Workstream A (immediate start):** Opening line data procurement
- Audit The Odds API historical MLB endpoint
- If insufficient: procure Don Best or equivalent
- Target: confirmed source with >90% coverage within 2-3 weeks

**Workstream B (immediate start, parallel):** 2023 structural break validation
- Pull 2019-2025 team-level metrics from Savant/MLB Stats API
- Compute year-to-year correlations for each metric pair (2019-20, 20-21, 21-22, 22-23, 23-24, 24-25)
- Test whether 2022-2023 correlation drops >0.10 below the 2019-2022 baseline
- Target: results within 2 weeks

**Workstream C (after A and B produce initial results):** Distribution validation study
- Items 3 (Poisson/NB/CMP + stratified overdispersion + Test B correlation + copula parameter stability)
- Sequenced after B because the structural break results inform whether pre-2023 data enters the distribution study

**Workstream D (parallel with C):** Calibration analytics
- Items 4 (wRC+-to-runs regression), 5 (prior-weight schedule), 6 (pitcher FIP stability), 7 (opener baseline)
- These are independent of each other and of the distribution study

**Phase 1a output:** Written analytical report covering all 7 must-complete items + the copula parameter subtest. Submitted for director review before any Phase 1b model code is written.

---

*Phase 1a begins today. Opening line audit and structural break analysis launch in parallel.*
