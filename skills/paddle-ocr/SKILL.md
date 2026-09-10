---
name: paddle-ocr
description: 画像・PDF・スクショからテキストを構造抽出したい時（請求書/領収書/名刺/フォーム/lead-finderの店舗看板等）。日英中韓100+言語、信頼度スコア+bounding box付き。バッチ/プログラム処理向け。内蔵ビジョンで足りない高精度・座標・大量処理が要る時に使う。
author: auto
created: 2026-06-09
version: 1.0.0
---

# PaddleOCR ローカルOCR

> ⚠️ **実体は削除済み（2026-07-03・本人承認）**: venvとCLI `ocr.py` は消滅。このskillは**再構築手順書＋検証済み知見**として保持。再構築: `uv venv -p 3.12 ~/dev/paddleocr/.venv && .venv/bin/pip install paddleocr`（モデルキャッシュ `~/.paddlex` は生存＝再DL不要）。`ocr.py` は本書の出力仕様（text/JSON両モード・box+score）を参考に再作成。以下のパス記述は当時のもの。

完全ローカル・無料。永続venv: `~/archive/retired-projects/oss-trial/paddleocr/`（py3.12、モデルは`~/.paddlex`にキャッシュ）。

## Procedure

```bash
cd ~/archive/retired-projects/oss-trial/paddleocr

# プレーンテキスト（1行=1領域、[信頼度] 本文）
.venv/bin/python ocr.py <画像orPDF> --lang japan

# プログラム用JSON（text+score+box座標）
.venv/bin/python ocr.py <画像> --json --min-score 0.85

# 言語切替: japan / en / ch / korean ...
.venv/bin/python ocr.py receipt.png --lang japan
```

- 推論は1画像~2-3秒（初回のみモデルロード+30秒）
- PDF直接OK。複数領域は`rec_texts`順で返る
- バッチは画像パスをループで`ocr.py`に渡す

## Pitfalls

- **桁区切り誤読**: `128,400`→`128.400`（カンマがピリオド化）。**金額は必ず目視 or `--json`のscore確認**。請求書/領収書で致命的
- **簡体字グリフ混入**: 日本語でも稀に `額→额` `処→处` 等の簡体字が出る（中国語データ主体のため）。重要語は要チェック
- **単語間スペース欠落**: `Thank you`→`Thankyou`。CJKは元々スペース無いので通常問題なし。英文は後処理で補う
- **低信頼行は0.85前後で自己申告**: `--min-score`で機械的に弾ける。怪しい行はscoreを見る
- **Python 3.14不可**: paddlepaddleのホイールが無い。venvは3.12固定（`uv venv --python 3.12`）
- `/tmp`に作らない（揮発）。venvは`~/archive/retired-projects/oss-trial/paddleocr`に退避中（元は~/oss-trial）

## Verification

```bash
cd ~/archive/retired-projects/oss-trial/paddleocr
.venv/bin/python ocr.py ocr_test.png --lang japan
# 期待: 5行抽出、請求書ヘッダ0.97/会社名0.98/合計金額0.86(低=桁注意)/支払期限0.96/英文0.98
```
2026-06-09検証: 日英混在請求書で文字精度95%+・推論2.3秒・低信頼行を0.86で正しくフラグ。
