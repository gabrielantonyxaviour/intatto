# Intatto submission open items

Prepared for okx-claude on 25 September 2026. Draft only; Gabriel approves the answers and submits himself.

The [official Builder Kit](https://www.okx.com/en-eu/learn/okx-dev-day-builder-kit) gives a deadline of **25 September 2026, 23:59 UTC = 26 September, 05:29 IST**. The selected route is in person, with finale attendance conditional on selection.

## Submission blockers and decisions

| Item | Current state | Needed before submission |
|---|---|---|
| Pages 2–3 and field limits | Headless inspection was login-gated; okx-claude then supplied [13 exact page 1 questions](FORM_PAGE1.md) from Gabriel's signed-in browser. Later pages are hidden behind required fields. | Reconcile pages 2–3 once Gabriel authorizes the required form entries. Their wording is explicitly unverified. Text character limits on page 1 remain unknown. Preserve the restored user draft; no password sign-in or Submit action by this helper. |
| Demo video URL | **TBD**. Final script exists at `film/storyboard/VO_SCRIPT.md` (v5.3); a script or QA recording is not a finished submission video. | Gabriel-approved final 2–4 minute working-product video and a **PUBLIC link**, e.g. YouTube, X or Instagram. Confirm duration, playback, audio and fork/replay/listing disclosures. No upload or publication authorized here. |
| Repository access | `https://github.com/gabrielantonyxaviour/intatto` confirmed **PRIVATE** with `gh repo view` during this task. | Gabriel chooses public visibility or reviewer access. Confirm the reviewer identity/access route if kept private. No visibility or permission change made. |
| Team identity | Project name Intatto is confirmed; Team Name, Team Size (1–4), and Team Members' Names are Gabriel's open items. | Match the accepted registration and exact legal names on IDs. AI helpers are not human team members. Confirm contact details only if later questions request them. |
| Finale attendance | In-Person (7 Oct 2026) is the chosen route; the separate required attendance scale is unanswered. | Gabriel chooses 0 (Unable to) through 4. Do not infer a scale value from the route or treat it as headcount without confirmation. |
| Team display picture | Optional one-image upload, max 10 MB, requested 1:1 aspect ratio. | Gabriel selects the image or chooses to leave it blank. No generation or upload performed. |
| Final review and declaration | Answers are drafts; actual declaration text is hidden by sign-in. | Gabriel reviews all answers, the actual declaration and event guidelines, resolves remaining placeholders, then personally submits. No declaration accepted on his behalf. |

## Disclosures to retain, not reasons to change the chosen track

- **OKX AI agent #13907: listing under review.** Read-only receipt check at approximately 18:04 UTC returned `calls: 0`, `total: 67`, `latest: []` for `source=okx-ai`. Total receipts are not OKX AI calls. A direct API response is not proof of an OKX AI marketplace invocation. An accessible marketplace listing URL is still unavailable in this draft; the working integration page is `/agents/credit`.
- **Paid API mode is off.** The x402 challenge is implemented/tested; payment verification and settlement are not wired. Do not describe payments or agent revenue as live.
- **Keeper trust remains explicit.** It relays the issuer quote and session; onchain price bounds do not turn it into a decentralized price oracle. The issuer supplies no source timestamp.
- **Mainnet NVDAx; sandbox-only SPYx.** Time travel, replays, impersonation, funding and widened fork-feed staleness settings belong to the fork and its divergence ledger. Historical CFD data is applied to today's fork, not historical X Layer liquidity. Synthetic 45% gap is labelled synthetic.
- **Lenders can lose money.** The reserve is finite, exit caps use sampled depth, and neither the replay nor the proof panel establishes general solvency or exhaustive state equality.
- **Verification scope:** current Circuit read-back is 7/7 screens, 10/11 systems, 7/8 journeys proven; `sc_keeper_live` is unverified and `blk_mainnet_deploy` remains unproven as a complete block. Gabriel's test acceptance is still pending. Deployed contracts and a working health endpoint do not close those gates.

## Prepared and checked

- [FORM_ANSWERS.md](FORM_ANSWERS.md): all 13 exact page 1 questions have answers or owner placeholders; later-page declaration is marked unverified wording. Technical supplement includes every manifest contract address linked to OKLink.
- [SUMMARY.md](SUMMARY.md): approximately 50-word and 200-word summaries.
- [FORM_INSPECTION.md](FORM_INSPECTION.md): headless sign-in blocker, coordinator-supplied page 1 field inventory, and remaining unknowns. [FORM_PAGE1.md](FORM_PAGE1.md) remains the coordinator's unchanged source.
- Read-only reachability: app, `/sandbox`, `/sandbox/proof`, `/agents/credit` all HTTP 200; `/api/credit/health` HTTP 200, `ok: true`, `network: mainnet`, block 71590416. This task did not create a sandbox session or rerun journeys.
- Existing source reports contain earlier run IDs and historical failures; the later QA re-check and current Circuit were used to avoid presenting those older snapshots as the final state. No claim of a new security audit.

No form filled or submitted; no password entered; no public post, upload, commit, deployment, or repository-access change made by this helper.
