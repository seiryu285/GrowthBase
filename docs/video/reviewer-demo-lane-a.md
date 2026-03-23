# Reviewer demo video — Lane A (70–100 s)

This document is the **production script** for a captions-only, no-narration screen recording.  
**This repo does not ship a rendered video file** — record and edit locally using the checklist below.

## Role of each lane

| Lane | Role in this video |
|------|---------------------|
| **Lane A** | Main story: public HTTPS → purchase success → receipt / proof → `fullyVerified` → durable evidence |
| **Lane B** | One closing line only: live fail-closed safety is preserved (no 503 footage in the main arc) |

## Layout (recommended)

| Region | Content |
|--------|---------|
| **Left** | PowerShell (font **18–22 px**, readability over line count) |
| **Right** | VS Code — `docs/evidence/lane-a-external-verify-bundle.success.json` (open **before** recording) |
| **Bottom** | One-line English subtitles (burn-in or editor track) |

Avoid full-screen CLI. Show **state changes**, not log reading.

## Pre-recording (off camera)

1. Open `docs/evidence/lane-a-external-verify-bundle.success.json` in the right pane (stable, git-tracked success bundle; no dependency on a live tunnel URL in the closing shot).
2. Increase terminal font to **18–22 px**.
3. **Never** show `.env`, keys, or secrets.
4. Run `pnpm.cmd proof:success-lane:tunnel` **once** before the real take so the live recording is predictable.
5. Optional: clear or minimize unrelated panels so the JSON keys listed in Scene 6 stay easy to scroll to.

## Do **not** include

- Tunnel URL details as readable proof (quick scroll is OK; do not make judges read hostnames).
- `.env` or any credentials.
- Long install/build logs.
- Lane B **503** or failure screens in the main arc.
- Vercel `/verify` as the primary proof (browser verify defaults to the live API DB; the **committed JSON bundle** is the canonical artifact for this video).
- `pnpm install` or dependency setup.

---

## Scene 1 — Fix what the video proves (0–5 s)

**Visual:** Black or minimal title card (no CLI yet).

**Subtitle:**

```text
GrowthBase lets agents buy machine-readable services over public HTTPS and receive verifiable delivery.
```

---

## Scene 2 — Public discovery (5–18 s)

**Commands:**

```powershell
cd C:\Users\blued\Downloads\GrowthBase
$env:API_BASE_URL = "https://growthbase-production.up.railway.app"
irm "$env:API_BASE_URL/offers" | ConvertTo-Json -Depth 8
```

**Show:** That `https://growthbase-production.up.railway.app/offers` returns **200** and a service listing exists. **Do not** dwell on full JSON — **pause 2–3 s** on the fact that offers are returned.

**Point:** Public **discovery** on live HTTPS (Lane B is **not** presented here as the purchase-success lane).

**Subtitle:**

```text
Agents can discover public services from a live HTTPS endpoint.
```

---

## Scene 3 — Start the success lane (18–35 s)

**Commands:**

```powershell
$env:PROOF_LABEL = "lane-a-public-tunnel-verify-2026-03-23"
pnpm.cmd proof:success-lane:tunnel
```

**Show:** Command line **large**; mid-run log may scroll quickly; **pause** only on success.

**What runs (for your subtitle “translation”):** resolve tunnel URL → start fixture API → wait for public DNS → run `external-verify-proof.ts` (external purchase + receipt + verify-bundle).

**Subtitle (full):**

```text
This command creates a public success lane, waits for the public endpoint to become reachable, and runs an external purchase + verification flow.
```

**Subtitle (short trim if needed):**

```text
This command creates a public success lane and runs an external purchase + verification flow.
```

---

## Scene 4 — Core success (35–55 s)

**Show:** Freeze on the terminal when **all** of the following are visible:

- `receiptId`: `receipt_9bdaebc54d5c7679` (IDs change each successful run; match `docs/evidence/lane-a-external-verify-bundle.success.json`)
- `transactionId`: `0x0cc36e526df881afb7c5c11f6e88652ec199fa84f1a90e7c4a7f34787b4b5e86`
- `fullyVerified`: `true`

**Subtitle (full):**

```text
The external purchase completes, a receipt is issued, an on-chain transaction is recorded, and the result verifies successfully.
```

**Subtitle (short):**

```text
The purchase completes, a receipt is issued, and the result verifies successfully.
```

---

## Scene 5 — Durable file on disk (55–65 s)

**Commands:**

```powershell
Get-ChildItem .\data\proofs\ | Sort-Object LastWriteTime -Descending | Select-Object -First 5 LastWriteTime, Name
```

**Show:** Latest proof filenames; **brief pause** on:

`external-verify-proof-lane-a-public-tunnel-verify-2026-03-23.latest.json`

**Subtitle:**

```text
Every successful run leaves durable machine-readable evidence.
```

---

## Scene 6 — Committed verification bundle (65–85 s)

**Commands:**

```powershell
code .\docs\evidence\lane-a-external-verify-bundle.success.json
```

**Right pane — scroll/highlight in this order:**

1. `"proofKind": "external-verify-bundle"`
2. `"outcome": "success"`
3. `"receiptId": "receipt_9bdaebc54d5c7679"` (under `purchase` is fine)
4. `"transactionId": "0x0cc36e526df881afb7c5c11f6e88652ec199fa84f1a90e7c4a7f34787b4b5e86"`
5. `"fullyVerified": true` (e.g. under `verification`)

**Do not** center `verifyUrl` / Vercel as the hero proof.

**Subtitle:**

```text
This verification bundle can be stored, shared, and inspected later.
```

---

## Scene 7 — Value + Lane B one-liner (85–95 s)

**Visual:** Black card **or** semi-transparent text over the JSON.

**Subtitle (main):**

```text
GrowthBase turns one agent action into paid execution, machine-readable delivery, and durable trust.
```

**Subtitle (small second line):**

```text
Lane A = reproducible public success · Lane B = live fail-closed safety preserved
```

---

## All in-video commands (copy block)

```powershell
cd C:\Users\blued\Downloads\GrowthBase
$env:API_BASE_URL = "https://growthbase-production.up.railway.app"
irm "$env:API_BASE_URL/offers" | ConvertTo-Json -Depth 8

$env:PROOF_LABEL = "lane-a-public-tunnel-verify-2026-03-23"
pnpm.cmd proof:success-lane:tunnel

Get-ChildItem .\data\proofs\ | Sort-Object LastWriteTime -Descending | Select-Object -First 5 LastWriteTime, Name

code .\docs\evidence\lane-a-external-verify-bundle.success.json
```

---

## Editing notes

- **Target length:** 70–100 s after trims.
- **Music:** Optional; keep captions readable.
- **End card:** Scene 7 can extend to ~100 s total if Scene 1–6 are tight.

## Related files

- Committed success bundle: [`../evidence/lane-a-external-verify-bundle.success.json`](../evidence/lane-a-external-verify-bundle.success.json)
- Lane A / B model: [`../success-lane.md`](../success-lane.md)
- Subtitle file for editors: [`reviewer-demo-lane-a-en.srt`](./reviewer-demo-lane-a-en.srt)
