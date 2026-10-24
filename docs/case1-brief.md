# Case 1: Franchise Partner Acquisition, Geo-Selection and Onboarding Engine

A fast-growing retail brand wants to open many more franchise stores, but the journey from a partner's first application to an open, trained store is slow and leaky. Build a solution that takes this journey off the expansion team's plate.

Reference companies: Lenskart (franchise-owned eyewear stores), Delhivery (franchise-run delivery centres), Amazon "I Have Space" (local shop owners handle deliveries and pickups).

Key terms: franchisor/franchisee; catchment (area a store's customers come from); cannibalisation (a new store taking sales from a nearby store of the same brand); payback period; onboarding (everything between acceptance and the store opening).

## Test data (judges upload Sheets 1 and 2; Sheet 3 is fixed)
Allowed values:
| City | State | Pin codes start with | City tier |
|---|---|---|---|
| Bengaluru | Karnataka | 560 | Tier 1 |
| Mysuru | Karnataka | 570 | Tier 2 |
| Mangaluru | Karnataka | 575 | Tier 2 |
| Hubballi-Dharwad | Karnataka | 580 | Tier 2 |
| Belagavi | Karnataka | 590 | Tier 2 |
| Tumakuru | Karnataka | 572 | Tier 3 |
| Davanagere | Karnataka | 577 | Tier 3 |
Preferred language: Kannada, English or Hindi.

**Sheet 1, Applications** (one row per applicant): Application ID; Applicant name; City; State; Pin code (6 digits); Investment capacity (₹ lakh); Retail experience (years, 0 if none); Current / past business (any text); Space available (Owned / Rented / Not yet identified); Space size (sq ft, blank if no space); Floor (Ground / Upper / Mall unit / Not known); Target launch (months); Preferred language (Kannada / English / Hindi); Notes from applicant (any text, may be messy).

**Sheet 2, Territories** (one row per territory): Territory ID; City; State; Pin codes covered (comma-separated 6-digit); City tier; Open slots; Priority (High / Medium / Low). Applications do not carry the territory ID: link applicants to territories by pin code.

**Sheet 3, Existing stores** (fixed, all stores open today): ST-01 Bengaluru 560001 (2019); ST-02 Bengaluru 560034 (2020); ST-03 Bengaluru 560038 (2021); ST-04 Bengaluru 560066 (2022); ST-05 Bengaluru 560076 (2023); ST-06 Mysuru 570009 (2021); ST-07 Mysuru 570017 (2024); ST-08 Mangaluru 575001 (2022); ST-09 Hubballi-Dharwad 580020 (2023); ST-10 Belagavi 590001 (2024).

File layout: row 1 is a title, row 2 the header, row 3 a grey example row, data from row 4. Example row: APP-001, Ravi Kumar, Mysuru, Karnataka, 570001, 25, 4, "Runs a footwear store", Rented, 450, Ground, 3, Kannada, "Wants to open before Diwali". Territory example: TER-01, Mysuru, Karnataka, "570001, 570002, 570008", Tier 2, 3, High.

Glossary: Investment capacity is the total money the applicant can put into setting up the store (1 lakh = ₹1,00,000). Retail experience is years running or managing any shop. "Mall unit" means a shop inside a shopping mall. Target launch is months from today. Tier 1 = large metros, Tier 2 = mid-size cities, Tier 3 = smaller towns. Open slots is how many more stores the brand wants in that territory. The brand never opens two stores in the same pin code.

## How judges will test the link
**Part 1, file upload.** They upload their own Applications and Territories sheets. Some applications are incomplete or contradictory, and several compete for the same territory. The brand never opens two stores in the same pin code.
**Part 2, follow-up questions.** After processing, they ask about decisions in plain language (for example "Why is APP-007 on hold?") and give new information (for example "APP-012 has now found a ground-floor space") and check the decision changes sensibly.

**For every application, from either part:** what should happen to that partner and why; for partners who move forward, what they need to do next and how they will be prepared to run the store. They judge our reasoning and how clearly the solution explains its decisions; there is no single right answer. The link must work without our help or a login.
