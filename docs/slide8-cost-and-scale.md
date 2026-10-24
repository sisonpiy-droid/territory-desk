# Slide 8: cost to run at volume, and what breaks at scale

## How it is built today (the facts the numbers rest on)
- One static web page on Vercel: `index.html` is 250 KB (72 KB gzipped) and the spreadsheet reader (SheetJS, served from the same site) is 861 KB (309 KB gzipped). That is about 380 KB over the wire, cached after the first visit.
- Every decision is worked out **in the user's own browser**. There is no server, no database, no language model and no paid API. Uploaded files never leave the laptop.
- So the cost does not grow with the number of applications. It grows only with the number of people who open the page.

## Cost to run at volume
| Item | Today (pilot) | Running it for real |
|---|---|---|
| Hosting the page | Rs 0: Vercel Hobby plan | Hobby is for non-commercial use, so a company would move to Vercel Pro (listed at USD 20 per member a month) or a free static tier (Cloudflare Pages, Netlify). Check current prices before quoting. |
| Traffic | About 0.4 MB per first visit | 30 people x 22 working days x 2 visits = about 0.5 GB a month, far inside any free tier |
| Computing decisions | Rs 0: runs in the browser | Rs 0 at any volume up to roughly 1,000 applications per file (see below) |
| Shared log, overrides and stage board | Not stored centrally | A small hosted database with team login (for example Supabase, free tier, then a listed USD 25 a month plan). Check current prices before quoting. |
| Messages to applicants | Copied and sent by hand: Rs 0 | WhatsApp Business messaging is charged per conversation by Meta; templates in Kannada, Hindi and English need approval once |

**Bottom line for the slide:** the pilot costs nothing to run. A company-grade version is one hosting plan plus one small database, about the cost of a single software seat. The real variable cost would be messaging, and only if it is automated.

## Measured: how decision time grows (laptop, Node.js, `node test/bench.js`)
| Applications in one file | Territories | Decide everything | 10% check on every threshold | Worklist and territory health |
|---|---|---|---|---|
| 20 | 9 | 8 ms | 31 ms | 2 ms |
| 100 | 9 | 20 ms | 0.3 s | 2 ms |
| 500 | 42 | 0.26 s | 4.8 s | 7 ms |
| 1,000 | 83 | 0.9 s | 17 s | 12 ms |
| 2,000 | 167 | 4.3 s | not run | 42 ms |

The judges' file (20 applications) decides in about 10 ms. A browser upload of 150 applications takes under half a second, including drawing the screen (`npm run e2e`).

## What breaks at scale, and the fix
1. **Decision time grows faster than the file.** Each held application is decided a second time to show "what would change this", so time grows roughly with the square of the file size: 0.9 s at 1,000 and 4 s at 2,000. *Fix:* decide one city at a time (cities never compete for pins), or move the work off the screen thread (a web worker).
2. **The 10% check is the heaviest part.** It re-decides everything 20 times, so it takes 5 s at 500 applications. It already switches itself off above 300 applications to keep the page quick. *Fix:* run it in the background and only for close decisions.
3. **One person, one browser tab.** Overrides, the decision log and the stage board live in the open page; a refresh or a second manager starts from scratch. *Fix:* a shared database and team login (the judges' version stays login-free).
4. **Spreadsheets as the way in.** Someone still exports and uploads a file, and bad data is only caught afterwards. *Fix:* an application form that checks the pin code, city and investment as the partner types, feeding the same rules.
5. **Pin-number distance stands in for real distance.** Neighbouring pin numbers are usually close, but not always, and the rule fails across city edges. *Fix:* pin-code centroids from India Post data, then catchment overlap from store sales.
6. **Messages are copied by hand.** Fine for 20 a week, not for 500. *Fix:* WhatsApp Business templates sent from the worklist, with replies feeding "Ask the desk".
7. **Fixed message templates in three languages.** Every new message type needs translating and a native-speaker check. *Fix:* a reviewed template library owned by the expansion team.
8. **One set of thresholds for the whole state.** Fine for 7 cities. A national rollout needs floors by city and format. *Fix:* the thresholds are already editable; they would move into a table by city.

## What else it could be used for (optional brownie point)
The same "rules, one-per-pin allocation, explain every decision" pattern fits dealer and distributor onboarding, pharmacy or kirana franchise networks, EV charging site partners, and delivery-centre partners (the Delhivery model from the brief).
