# MenuWise economic model specification

## Scope and units

The decision period is one month with `D` operating days. Money is CNY. Menu and pricing quantities are whole portions/month. Capacity plans use whole portions/day and one common resource measured in minutes/day. Fixed costs are monthly. Expansion cost is entered per day and multiplied by `D` exactly once.

Inputs are observations or user assumptions. An arithmetically calculated figure is not independently verified business evidence. Outputs that depend on future sales, costs or available minutes are conditional estimates.

Let `p_i` be a selling price, `q_i` monthly volume, `a_i` avoidable dish-specific fixed cost, `F_common` shared fixed cost, `t_i` bottleneck minutes per portion, and `r_i` commission percent. Non-commission variable cost comprises ingredient, packaging, piece-rate labor and other variable costs.

## Cost and profit identities

```text
commission_i = round_to_cent(p_i × r_i / 100)
base_i = total variable cost input OR sum(food_i, packaging_i, piece_labor_i, other_i)
v_i = base_i + commission_i
c_i = p_i − v_i
Revenue R = Σ p_i q_i
Variable cost V = Σ v_i q_i
Contribution C = R − V = Σ c_i q_i
Fixed cost F = F_common + Σ a_i
Operating profit Π = C − F
```

Do not add `a_i` into `F_common` as well. Common rent or fixed salaries do not disappear merely because a dish stops selling. Allocating them among dishes does not make them relevant to a drop decision. Already-incurred sunk costs do not change between alternatives. A zero-volume dish's fixed costs still remain unless an explicit removal scenario avoids them.

These conventions produce a managerial operating-profit measure, not gross margin, cash flow or after-tax profit. The application does not invent missing tax or financing adjustments.

## Cost–volume–profit analysis

With the observed sales mix held constant:

```text
Weighted contribution-to-sales ratio m = C / R
Break-even revenue B = F / m
Revenue for target operating profit P = (F + P) / m
Daily requirement = monthly requirement / D
Margin of safety = R − B
Margin of safety ratio = (R − B) / R
```

The contribution ratio is **revenue weighted**, not an unweighted average of dish percentages. If there is no revenue, the observed mix is undefined. If its contribution ratio is zero or negative, the application does not divide by zero or imply that more sales can cover positive fixed costs. It returns an explanatory non-result.

For a target revenue `R*`, the algebraic mix scaling is `k = R*/R`. To respect minimum-supply commitments, the executable mix uses at least:

```text
k_plan = max(k, max_i (minimum_i × D / q_i)), for q_i > 0
```

A zero-volume dish with a positive minimum cannot be produced by scaling the original mix; that is flagged. The plan is checked against every dish's demand cap and the total available resource. The displayed theoretical revenue threshold stays distinct from a higher minimum-supply plan. Fractional average volumes are legitimate in CVP but are not presented as a daily integer schedule.

The fixed-cost alternative subtracts only a user-entered reduction from `F_common`. The cost-increase stress scenario proportionally increases the baseline variable-cost total. Neither is a forecast. Linear behavior, stable mix, stable prices, sales of all output and a valid fixed-cost range are necessary assumptions. See [ACCA's CVP discussion](https://www.accaglobal.com/uk/en/student/exam-support-resources/fundamentals-exams-study-resources/f5/technical-articles/CVP-analysis.html).

## Pricing and incremental decisions

For one dish, other dishes held constant:

```text
ΔΠ = c_new × q_new − c_old × q_old − incremental_fixed_expense
Π_new = Π_base + ΔΠ
```

Commission is recalculated at the new price. With `N = old contribution + incremental_fixed_expense`, preserving the old profit requires `c_new × q_new ≥ N`.

- If `c_new > 0`, the smallest nonnegative integer volume is `max(0, ceil(N/c_new))`.
- If `c_new = 0`, a solution exists only when `N ≤ 0`; its minimum is zero.
- If `c_new < 0`, a solution exists only when `N ≤ 0`; the feasible volumes have a maximum `floor(N/c_new)`. Additional sales reduce profit.

All whole-menu monthly demand/minimum conditions and aggregate bottleneck minutes are checked. These are monthly-average checks and cannot guarantee peak-hour service. Sensitivity uses an explicitly entered symmetric volume change; volume is rounded to whole portions. It has no inferred probability or estimated elasticity.

## Menu decisions and relevant costs

Four explicit alternatives are compared: no change, lower variable cost, additional promotion, and removal.

```text
Cost-improvement ΔΠ = unit saving × unchanged volume − implementation expense
Promotion ΔΠ = incremental contribution − incremental promotion expense
Removal ΔΠ = avoidable fixed cost − lost dish contribution
             − lost associated contribution + replacement contribution
             − exit expense
```

The app disallows a claimed unit saving greater than the adjustable non-commission variable cost. Commission cannot be eliminated by claiming an ingredient saving. Replacement contribution is entered separately from revenue and requires its own time estimate, within total available time after removing the dish (released plus already-idle time). Other retained dishes must remain within their constraints. Removal is not executable while a minimum-supply commitment remains.

The ranking shown in the overview is only a diagnostic. No industry popularity threshold or margin benchmark is invented. The actual recommendation is the highest operating profit among the explicitly evaluated feasible alternatives, with unchanged operations winning exact ties when listed first. See [OpenStax §10.4](https://openstax.org/books/principles-managerial-accounting/pages/10-4-evaluate-and-determine-whether-to-keep-or-discontinue-a-segment-or-product) for relevant-cost treatment of keeping or discontinuing a product.

## Exact single-resource optimization

For each dish, choose integer daily quantity `x_i`:

```text
maximize   Σ c_i x_i
subject to Σ t_i x_i ≤ T
           minimum_i ≤ x_i ≤ demand_i
           x_i integer
```

Fixed costs do not change with the production mix, so maximizing contribution also maximizes modeled operating profit for a given capacity option. A separate capacity expansion alternative subtracts its entered incremental daily cost before comparing profits.

Implementation:

1. Assign all mandatory minimum quantities. If a minimum exceeds demand or mandatory time exceeds `T`, return `infeasible`.
2. Convert minutes to exact half-minute integer ticks; inputs not representable in these ticks are rejected, not rounded.
3. For known zero-time dishes choose demand if contribution is positive, otherwise the minimum; they consume no bottleneck ticks. Represent other positive optional quantities as bounded binary groups. Nonpositive-contribution optional output is unnecessary; mandatory loss-making output is retained.
4. Apply descending-capacity zero-one dynamic-programming transitions for each group, using integer-cent values and separate per-group backtracking choices.
5. Choose the best value over all capacities up to the limit, leaving idle time when appropriate. Backtrack to valid integer quantities.

Every integer amount from zero through a dish's bound is representable by its groups. Descending transitions prevent a group from being reused. Thus the final result is exact for the declared bounded, single-resource integer model. Ties may have multiple optima. A greedy contribution/minute sort is not a valid integer guarantee: at capacity 4, one item with time 3 and value 5 loses to two items with time 2 and value 3 each, despite its higher density.

`optimal`, `incomplete`, `infeasible`, and `limit` are distinct statuses. More than 20 million DP states causes an explicit limit response, without a fabricated answer. Maximum supported daily time is 10,000 minutes, menu length 40, and each demand bound 10,000 portions. Required operation sizes are checked before allocation.

The economic motivation for allocating scarce resources according to contribution is described in [OpenStax §10.6](https://openstax.org/books/principles-managerial-accounting/pages/10-6-evaluate-and-determine-how-to-make-decisions-when-resources-are-constrained). MenuWise's integer solver additionally respects indivisible portions; it is not a general multi-resource scheduling optimizer.

## Numerical and data safeguards

- Monetary inputs have at most two decimal places; percentage rates have at most two decimals.
- Unit commission uses integer rate basis points and half-up cent rounding: `floor((price_cents × rate_basis_points + 5000) / 10000)`. Subsequent base amounts aggregate integer cents. This is a per-portion convention; platform invoice rounding can differ.
- Input aggregate financial scale above 10^13 cents is rejected conservatively to preserve cent round trips.
- CVP division and per-day profit allocation use floating-point ratios; rounding is for display, not constraint decisions.
- Required sales counts use ceiling; optimizer quantities are integral by construction.
- Required price, base cost and volume are explicit. Optional incremental expenses, commission and minimums default to zero, with import defaults disclosed. Missing fixed costs withhold absolute profit/CVP. Missing days, time, capacity or demand withhold operational verification and optimization. Known zero time is supported.
- Inconsistent minimum/demand or recorded-volume/current-capacity conditions are surfaced, while retaining valid financial records for diagnosis.
- Valid assumption edits recalculate immediately; invalid edits clear previous results. Saved reports include input snapshots, and baseline changes trigger a stale-report notice.
- A backup restore validates financial input and report structure before replacing the current state. Exported text is escaped; CSV cells with spreadsheet formula prefixes are neutralized.

## Verification

The model suite checks independent worked answers, fractional commission, weighted mix, loss-making and zero-margin cases, missing inputs, oversized arithmetic, price floors, avoidable/shared costs, whole-menu feasibility, minimum-supply target adjustments and import failures. Three hundred seeded optimization cases (200 four-dish cases plus 100 cases including zero-time dishes) are independently exhaustively enumerated and compared with the dynamic program. The counterexample above guards against substituting a greedy ranking for exact optimization.

## Version 2 boundary cases

When contribution ratio, fixed costs and target profit are all zero, every otherwise feasible volume has zero profit: status `flat`, no unique threshold and no margin-of-safety ratio. With negative contribution, zero fixed costs and zero target, only zero output avoids loss; mandatory positive output is infeasible (`boundary`). Missing days prevent daily targets from being displayed.

Financial comparisons can show a conditional incremental difference without complete overhead or operational data. Their absolute profit is withheld if fixed costs are unknown, and their feasibility label is explicitly financial-only until all operational inputs are supplied. Capacity expansion expenses use the scenario trading days, not an unrelated baseline period.
