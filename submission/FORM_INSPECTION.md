# OKX Dev Day 2026 form inspection

Inspected 25 September 2026, approximately 18:03 UTC, using a fresh, unauthenticated headless Playwright Chromium browser. Read-only navigation; no fields filled, no buttons clicked, no password used, no submission. Browser closed afterward.

## Result: Google sign-in gate

- Requested: https://forms.gle/81S2gnFCzqSoeDEA7
- Resolved form: https://docs.google.com/forms/d/e/1FAIpQLScoFQsVBvoatzVyi0XqdLwP_rfhrhUqiMP4O1jkjJgIFp3mFA/viewform
- Actual destination: `accounts.google.com/v3/signin/identifier`, with that form in its `continue` parameter.
- Page title: **Google Forms: Sign-in**.
- Visible text: **“Sign in”**, **“to continue to Google Forms”**, **“Email or phone”**.
- Google sign-in is required to inspect the form from this fresh browser. Whether a particular account, organization membership, or upload permission is required is unknown.
- No project questions or Google Forms question metadata were exposed (`FB_PUBLIC_LOAD_DATA_` absent). Login controls are not submission questions.

The initial read raced Google's redirect; a second navigation waited for `networkidle` and captured the settled sign-in page. No authentication workaround was attempted.

## Authenticated page 1 inventory supplied by okx-claude

After the headless gate was reported, okx-claude independently read **page 1 of 3** in Gabriel's already signed-in browser and supplied [FORM_PAGE1.md](FORM_PAGE1.md). Nothing was typed, clicked or submitted. This is coordinator-observed evidence, not a claim that this helper authenticated.

Section for all rows: **page 1**; no additional named section was recorded. Google sign-in was needed for access. “Unknown” means the capture does not establish a limit, not that the field is unlimited.

| # | Exact question | Required? | Type | Options / constraints | Character limit |
|---|---|---|---|---|---|
| 1 | Team Name | Yes | Short text | — | Unknown |
| 2 | Team Size | Yes | Choice | 1; 2; 3; 4 | Not applicable |
| 3 | Team Members' Names | Yes | Text | Exact full names matching IDs | Unknown |
| 4 | Which track is the team participating in? | Yes | Choice | Build a Market – build with X Layer; Build a Company – OKX AI | Not applicable |
| 5 | Participation Route | Yes | Choice | In-Person (7 Oct 2026); Remote | Not applicable |
| 6 | Would the team be able to attend our in-person finale? | Yes | Scale | 0 (Unable to) through 4 | Not applicable |
| 7 | Team Display Picture [1:1 Image] | No | File upload | One image; maximum 10 MB; 1:1 image | Not applicable |
| 8 | Project Name | Yes | Short text | — | Unknown |
| 9 | Project Summary | Yes | Paragraph | Product, intended user, core integration; keep brief | Unknown |
| 10 | Repository Link | Yes | Short text | Public or access given to OKX; clear README | Unknown |
| 11 | Demo Video | Yes | Short text | Public link; working-product demo; 2–4 minutes; e.g. YouTube, X or Instagram | Unknown |
| 12 | Product Link | Yes | Short text | Live product, deployment or test environment; if unavailable explain and point to demo | Unknown |
| 13 | Is this a new project, or are you adding features to an existing one? | Yes | Choice | Yes, new project; No, project is built on a pre-existing codebase or product | Not applicable |

The page reports **“Your progress has been restored”**. A user-owned partial draft may exist; it was not changed. Pages 2 and 3 are hidden behind required page 1 fields. No attempt was made to fill them merely to advance. Their questions, section titles, count, required/optional flags, widgets, options and character limits are still unknown.

## Pages 2–3 fallback: unverified wording

The supplied [builder-kit snapshot](../../../hackathons/okx-dev-day-2026/ideation/sources/builder-kit.md), checked against the [current official Builder Kit](https://www.okx.com/en-eu/learn/okx-dev-day-builder-kit), lists six package items: Team and track; Project summary; Repository; Demo video; Product link; Declaration. The observed page 1 covers the first five. A declaration about accuracy and guidelines remains expected from the kit, but its actual wording and placement are unverified. No other hidden questions can be inferred reliably.

The kit also requests contract addresses and technical links for Build a Market. These are prepared as a supplement in [FORM_ANSWERS.md](FORM_ANSWERS.md); the actual field placement is unknown. The [briefing snapshot](../../../hackathons/okx-dev-day-2026/ideation/sources/okx-briefing-session-1.md) does not transcribe the remaining questions or validation.

## Handoff boundary

[FORM_ANSWERS.md](FORM_ANSWERS.md) drafts an answer or explicit owner placeholder for all 13 observed questions, plus the unverified declaration and technical material. It cannot certify complete coverage of pages 2–3. Reconcile their actual questions and all field limits before Gabriel approves and submits. This preparation task must never click Submit or accept declarations on his behalf.
