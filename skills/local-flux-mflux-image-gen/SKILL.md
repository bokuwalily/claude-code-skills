---
name: local-flux-mflux-image-gen
description: Macでローカル無料・無制限の高品質画像生成をしたい時。FLUX.1-schnellをmflux(MLX)で動かす。「無料で画像生成」「Gemini無料で画像」「FLUXローカル」等で発火。Gemini無料APIは画像がlimit:0で使えない事実も含む。
author: auto
created: 2026-06-23
version: 1.1.0
---

## Procedure

ツール実体: `~/dev/flux-mflux/`（venv=`.venv` / mflux+mlx / py3.13）。生成は:
```
~/dev/flux-mflux/flux.sh "プロンプト" [out.png] [seed]
```
内部コマンド（これが正解の形）:
```
~/dev/flux-mflux/.venv/bin/mflux-generate --model schnell --quantize 8 \
  --prompt "..." --steps 4 --height 1024 --width 1024 --output out.png [--seed N]
```
- モデル=公式 `black-forest-labs/FLUX.1-schnell` を mflux が**自前で量子化**（HF認証済み: user=bokuwalily）
- schnellは4step固定で十分。1枚 ~2分40秒（M5）、ピークメモリ ~24.76GB
- 省メモリ/高速化したいなら `--quantize 4`

新規Mac環境での再構築:
```
uv venv --python 3.13 ~/dev/flux-mflux/.venv
uv pip install --python ~/dev/flux-mflux/.venv/bin/python mflux
~/dev/flux-mflux/.venv/bin/hf auth login --token <HF_READ_TOKEN>   # schnellライセンス同意も必要
```

## Pitfalls

- **Gemini無料APIで画像は出ない**: `gemini-2.5-flash-image` は無料Tierが `limit: 0`（2025-12削減）。429 RESOURCE_EXHAUSTED で `limit: 0` が出る。テキスト(gemini-2.5-flash)は無料で動く。画像は課金有効化が必須。
- **公式FLUX.1-schnellはHFゲート付き**（Apache-2.0だが click-through 同意が要る）。`401 GatedRepoError`。HFログイン+schnellページで「Agree and access」(即承認・待ち無し)+Readトークン。
- **ゲートなしの既製4bitリポ(madroid/dhairyashil等)は最新mfluxで非互換**: `ValueError: [dequantize] The matrix should be given as a uint32`。古いmflux形式。→ 使わず、公式schnellを `--quantize 8` で**自前量子化**するのが正解。
- **最新mfluxは `--path` 廃止**。ローカルモデルは `--model <dir> --base-model schnell`、公式DLは `--model schnell`。
- nohup `&` で投げると即死して空ログになることがある→ background task かMonitorで追う。Monitorのpgrepは macOS で `\|` 不可、別々の `pgrep -f` を `&&`/`||` で繋ぐ。
- 日本語の文字描画は不可。文字入れはPIL後乗せ（senior-tube lib流用）。
- **並列2本同時生成はメモリ競合(M5 24GB)で激遅/timeout**→逐次で回す。複数枚は1本ずつ直列のループスクリプトをbackground実行し完了flagをポーリング。

## キャラ一貫性＋透過（LINEスタンプ等・実例=line-stamps-keigo）

同一キャラの複数表情を作る（マスコット/スタンプ向け）:
- **seed固定(例42)＋詳細なキャラ仕様プロンプトを全表情で共通**にし、末尾の表情/ポーズ語だけ差し替える。schnellでもこれで同一キャラに見える(body色/服/小物が揃う)。例: `"<固定キャラ仕様>, <expr>"` で expr= happy smile / calm neutral / bowing eyes closed / nervous sweat drop / panicking wide eyes
- bodyは純白でなく**クリーム/淡色**にし背景は `plain solid pure white background` 指定→後段の透過が確実
- 完全一貫が要るなら `mflux-generate-kontext`(画像編集モデル,12Bで重い)で master画像から表情だけ編集

白背景→透過（キャラ内部の白を残す）:
- 単純な明度閾値だと目のハイライト等の内部白も消える。**四隅からflood-fillして"連結する背景白"だけ抜く**のが正解（端BFS、`is_background`=高明度かつ低彩度なら影グレーも抜く）。実装=`~/digital-products/line-stamps-keigo/src/mascot_flux.py`
- 透過確認は青/チェッカー背景に合成してRead目視。四隅alpha=0をassert

## Verification

- `file out.png` が `PNG image data, 1024 x 1024` を返す
- 生成画像を Read して目視（ダミー/壊れでないか）。test例: 三毛猫×畳×障子で写実が出れば成功
- ログ末尾に `Peak MLX memory` と `saved:` が出る
