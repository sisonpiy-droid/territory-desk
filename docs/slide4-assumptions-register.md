# Slide 4: assumptions and how we would check them

Generated from the app (Records, Assumptions register) by `node test/make-register-doc.js`. Every row is shown on screen as an assumption, can be edited where the "Change it" column says, and has a real-world check.

## Decision rules

| Assumption | Default | Change it | How we would check it |
|---|---|---|---|
| Minimum investment by city tier (Tier 1 / 2 / 3, Rs lakh) | 30 / 25 / 20 | Assumptions page | Actual fit-out and opening cost of the brand's last stores in each tier. The public quote of Rs 20 to 35 lakh is third-party and unofficial. |
| Reject below this share of the minimum investment | 70% | Assumptions page | Share of held applicants in past files who closed a funding gap within 30 days; below this level, check whether anyone ever did. |
| Minimum space (sq ft) | 250 | Assumptions page | Sales per sq ft by size band across existing stores. A public listing quotes 250 to 500 sq ft. |
| Ideal space range (sq ft) | 300 to 500 | Assumptions page | Same check: which size band performs best at existing stores. |
| Upper floors are held; ground floor and mall units pass | Fixed rule | Engine rule | Footfall and sales of existing upper-floor versus ground-floor stores. |
| One store per pin code | Fixed rule | Engine rule | Stated in the brief; confirm with the brand whether very large pin codes can ever take two stores. |

## Scoring

| Assumption | Default | Change it | How we would check it |
|---|---|---|---|
| Spacing risk: high within, medium within (pin numbers apart) | 5 / 25 | Assumptions page | Replace pin-number distance with real distance, then check how much sales fell at the nearest store when a new one opened within 2 km. |
| Score weights (capital / experience / space / timeline / spacing / data) | 25 / 20 / 25 / 10 / 10 / 10 | Assumptions page | Back-test: do past applicants who scored higher run better stores (12-month sales)? Re-weight until the ranking matches. |

## Timing and onboarding

| Assumption | Default | Change it | How we would check it |
|---|---|---|---|
| Earliest realistic opening (weeks), and extra if no space yet | 10 + 6 | Assumptions page | Time each step (agreement, fit-out, training, opening) for the last 5 stores and use the 80th percentile. |
| First-time retailer if under (years of experience) | 1 | Assumptions page | Compare the first 90 days of sales of first-time and experienced retailers at existing stores; set the cut-off where they separate. |
| Go-live gates, days before opening (licences, GST, fit-out, training, stock, signage, POS) | 28 / 28 / 21 / 14 / 10 / 7 / 5 | Source code (golive.js) | Actual lead times of each gate at the last stores; move the due dates to match. |

## Offers

| Assumption | Default | Change it | How we would check it |
|---|---|---|---|
| Offer window (days to sign) | 7 days | Offers page | Median days from approval to signed agreement in the brand's last 10 approvals; set the window to the 80th percentile. |

## Pipeline plan

| Assumption | Default | Change it | How we would check it |
|---|---|---|---|
| Use a territory's own placement rate from | 8 applications | Pipeline plan | Compare each territory's rate with the brand's approval-to-placement history; below this sample size the overall rate is used. |
| Share of fixable holds expected to clear | 0% | Pipeline plan | Share of held applicants in past files who fixed the gap within 30 days. |
| Recruiting period for a weekly target | 8 weeks | Pipeline plan | The brand's planned recruiting window for the territory. |

## Territory levers

| Assumption | Default | Change it | How we would check it |
|---|---|---|---|
| Lever owners | Named roles | Pipeline plan | Replace with the brand's real roles; each lever needs one named person. |
| Incentive cost and value of a store to the brand | Blank (no money figures) | Pipeline plan | Finance supplies the cost of an incentive and the monthly fees, royalty and margin of a store; the page shows only the break-even. |

## Site finder

| Assumption | Default | Change it | How we would check it |
|---|---|---|---|
| Crowd blend: share from residents (rest is daytime activity) | 50% | Site finder, Assumptions | Back-test against sales by hexagon at existing stores once store addresses are available. |
| Weight of the 6 touching and the next 12 hexagons | 0.5 / 0.25 | Site finder, Assumptions | Customer home postcodes from billing: how far from the store do customers actually come? |
| Activity points per place (market, mall, rail and so on) | 3 / 4 / 2 / 3 / 0.5 / 4 / 2 / 2 / 0.2 | Site finder, Assumptions | Walk-in counts at existing stores near each kind of place. |
| Overlap penalty (points per 1% of crowd already reached) | 1 | Site finder, Assumptions | Compare recommended sites with where the brand actually opened its best stores. |

## Catchment overlap

| Assumption | Default | Change it | How we would check it |
|---|---|---|---|
| Store catchment radius by tier (Tier 1 / 2 / 3, km) | 2 / 3 / 5 | Site finder, Assumptions | Customer-origin data: the radius that holds 80% of existing stores' customers. Existing stores overlap each other by under 20% at 2 km. |
| Overlap that flags / suggests a hold | 40% / 60% | Site finder, Assumptions | Sales change at the nearest store after a new opening, by overlap level. |

## Payback and bad six months

| Assumption | Default | Change it | How we would check it |
|---|---|---|---|
| Monthly sales: best / base / worst (Rs lakh) | 8 / 6.7 / 5.5 | A record, Plan tab | Set so a Rs 25 to 35 lakh store pays back in 12 to 18 months (public, unofficial quote). Replace with the brand's average monthly sales by tier from existing stores. |
| Gross margin | 45% | A record, Plan tab | Finance's gross margin on a typical basket at existing stores. |
| Monthly running costs (rent, staff, utilities) | Rs 1 lakh | A record, Plan tab | Average monthly cost of an existing store, by tier, from the franchise P&L. |
| Bad-month sales levels | 50%, 70%, 90% of base | A record, Plan tab | Compare with the lowest first-six-month sales at existing stores as a share of their steady-state sales. |
| Investment to recover | Store cost for the tier | A record, Plan tab | Actual fit-out and opening cost of the last stores, by tier. |

## Confidence and fragility

| Assumption | Default | Change it | How we would check it |
|---|---|---|---|
| High / medium confidence cut-offs (points clear of the next rival) | 10 / 3 | Source code (whatif.js) | Review the low-confidence decisions with the expansion head for a month; widen or narrow the cut-offs to match where people actually disagreed. |
| A decision is fragile if it flips when a threshold moves by | 10% | Source code (whatif.js) | Set to the team's real uncertainty about each threshold (for example the spread of fit-out costs across the last stores). |

## Time saved

| Assumption | Default | Change it | How we would check it |
|---|---|---|---|
| Minutes by hand: screen one application / cross-check one pin / write one follow-up | 20 / 5 / 15 | Overview, Before and after | Time five real applications with the expansion team before the pilot and use the median. |
| Minutes with the desk: review one decision / send one message | 3 / 2 | Overview, Before and after | Time the same five applications in the tool during the pilot. |
| Hours of screening per day (to show days saved) | 3 | Overview, Before and after | Ask the expansion team how many hours a day they really spend on screening. |

## What the tool deliberately does not assume

- **Offers:** no drop-off rate. When an offer lapses the next waitlisted applicant is promoted, so nothing is ever offered twice and no over-offering percentage is needed.
- **Territory levers:** no rupee figures. The page names the lever and an owner; money appears only if the team types its own incentive cost and store value, and then only as a break-even.
- **Bad six months:** uses the same placeholder sales and costs as the payback band, labelled illustrative, with the real check being the first six months of sales at existing stores.
