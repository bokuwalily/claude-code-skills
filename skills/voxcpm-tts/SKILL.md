---
name: voxcpm-tts
description: テキストから音声を合成したい時（動画ナレーション/ショート動画の読み上げ/ボイスオーバー/声真似クローン）。多言語TTS、参照音声で声マネ可。MoneyPrinterTurbo・HyperFrames動画パイプの読み上げ工程に使う。完全ローカル・無料(Claude MAX外課金なし)。
author: auto
created: 2026-06-09
version: 1.0.0
---

# VoxCPM ローカル音声合成(TTS)

OpenBMB製・完全ローカル・無料。永続: `~/oss-trial/VoxCPM/`（py3.11、MPS、モデル`openbmb/VoxCPM2`は`~/.cache/huggingface`）。

## Procedure

```bash
cd ~/oss-trial/VoxCPM

# 基本: テキスト→WAV
.venv/bin/python tts.py "読み上げる文" -o out.wav

# 声真似(voice cloning): 参照音声+その書き起こしを渡す
.venv/bin/python tts.py "好きな文" -o out.wav --ref ref.wav --ref-text "参照音声の中身"

# 品質/表現調整
.venv/bin/python tts.py "文" -o out.wav --steps 20 --cfg 2.5
```

- 出力48kHz WAV。`--steps`増=高品質/遅、`--cfg`=表現の強さ
- 動画パイプ: ナレ原稿→`tts.py`でWAV→MoneyPrinterTurbo/HyperFramesの音声トラックに差す
- 参照音声は数秒のクリーンなWAVでOK

## Pitfalls

- **初回ロードが重い**: モデル+denoiser読込で数十秒。常駐させず必要時のみ実行（MCP化しなかった理由）
- **Python 3.14でtorch不可**: venvは3.11固定。`uv venv --python 3.11`
- **MPS(Apple Silicon)で動作**: device自動検出。CUDA無し環境前提
- **長文は分割**: 1回のgenerateは1段落〜数文が安定。長尺は文単位でループ生成→結合
- **`--ref`使うなら`--ref-text`必須**: 書き起こし無いと声マネ精度が落ちる
- 商用利用・なりすまし注意: 他人の声クローンは同意の範囲で

## Verification

```bash
cd ~/oss-trial/VoxCPM
.venv/bin/python tts.py "これはテストです。" -o /tmp/voxcpm_check.wav
.venv/bin/python -c "import soundfile as sf;w,sr=sf.read('/tmp/voxcpm_check.wav');print(f'{len(w)/sr:.1f}s @ {sr}Hz')"
# 期待: 数秒のWAV @ 48000Hz が生成される
```
2026-06-09検証: 日本語26文字→7.4秒WAV @ 48kHz 生成成功（MPS）。
