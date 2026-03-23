# 公開デモ動画・手元検証用 — コマンド順（PowerShell）

**前提:** `cloudflared` が PATH にあること（Lane A トンネルに必要）。`.env` や鍵は画面に映さない。

## 1. リポジトリへ移動

```powershell
cd C:\Users\blued\Downloads\GrowthBase
```

## 2. Lane B — 公開サービス発見（ライブ HTTPS）

```powershell
$env:API_BASE_URL = "https://growthbase-production.up.railway.app"
irm "$env:API_BASE_URL/offers" | ConvertTo-Json -Depth 8
```

期待: HTTP 200、`polymarket-hidden-edge-scan` が一覧に含まれる。

## 3. Lane A — 公開成功レーン（トンネル + 外部 verify）

```powershell
$env:PROOF_LABEL = "lane-a-public-tunnel-verify-2026-03-23"
pnpm.cmd proof:success-lane:tunnel
```

期待: 終了時に JSON で `outcome: success`、`receiptId`、`transactionId`、`fullyVerified: true`、`proofPaths`。

所要時間: ネットワーク次第で数分。

## 4. 証跡ファイルの確認

```powershell
Get-ChildItem .\data\proofs\ | Sort-Object LastWriteTime -Descending | Select-Object -First 5 LastWriteTime, Name
```

## 5. コミット済み成功バンドル（右ペイン用）

```powershell
code .\docs\evidence\lane-a-external-verify-bundle.success.json
```

**注意:** 手順 3 の直後に最新ランをリポジトリに残すには、運用者が `data\proofs\external-verify-proof-*.latest.json` を `docs\evidence\lane-a-external-verify-bundle.success.json` にコピーしてコミットする（CI では任意）。

## オーケストレーターのバグ修正

`pnpm proof:success-lane:tunnel` 終了後に `once is not defined` が出る場合は、`scripts/public-success-lane-tunnel-proof.ts` に `import { once } from "node:events"` があること（現在の main では修正済み）。
