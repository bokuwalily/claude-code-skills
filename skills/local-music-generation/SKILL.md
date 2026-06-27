---
name: local-music-generation
description: 曲・BGM・音源を無料ローカルで作りたい時。MIDI作曲(コード進行+メロ+ベース+ドラム)とAI音源生成(MusicGen)の2経路。Mac/Apple Silicon前提
author: auto
created: 2026-06-16
version: 1.0.0
---

## Procedure

作業ディレクトリ `~/dev/music-lab/`。完全無料・ローカル完結。

### 経路A: MIDI作曲（速い・自分で編集可・GarageBandで開ける）
```bash
cd ~/dev/music-lab
python3 compose.py --mood lofi --key A --bpm 75 --bars 16 --out out/track
bash render.sh out/track.mid   # → mp3（fluidsynth + FluidR3_GM.sf2）
```
- ムード: `lofi / chill / cinematic / citypop / lullaby`
- `.mid` をGarageBandで開けば打ち込み・音色差し替え可能
- 依存: `mido`（pure python, 3.14でもOK）, `fluidsynth`(brew), soundfont `soundfonts/FluidR3_GM.sf2`(148MB)

### 経路A+: フル構成曲＋配信マスター（リリース用）
```bash
python3 arrange.py --title "NIGHT DRIVE" --key A --bpm 128 --out out/track  # intro→build→drop→break→drop→outro
bash master.sh out/track.mid   # → -14 LUFS / クリップ回避の WAV+MP3（配信基準）
python3 make_cover.py --title "NIGHT DRIVE" --artist Lily --style neon --out out/cover  # 3000x3000ジャケ(無料・APIキー不要)
```
- `arrange.py`: レイヤーをセクションごとにON/OFFして展開を作る。絶対tickでイベント生成→delta変換でズレ無し
- `master.sh`: fluidsynth -g 0.45 でヘッドルーム確保 → ffmpeg loudnorm I=-14:TP=-1.0
- `make_cover.py`: neon/grid/acid スタイル。Pillowのみ・無料
- 配信は権利100%自分のMIDI自作曲で（MusicGenはCC-BY-NC不可）。詳細は ~/dev/music-lab/RELEASE.md

### 経路B: AI音源生成（本格的な音色・プロンプトから）
```bash
bash ai.sh "lofi hip hop, mellow rhodes, vinyl crackle, rainy night" 12 out/ai_lofi
```
- transformers の MusicGen を別venv `.venv-mg`(Python 3.12) で実行
- 構築: `uv venv --python 3.12 .venv-mg && source .venv-mg/bin/activate && uv pip install torch transformers scipy`
- モデル: `facebook/musicgen-small`(~2GB初回DL)。`--model facebook/musicgen-medium`で高品質(遅い)
- MPS(Apple GPU)で動く。**生成は実時間の約10倍**（8秒音声=約82秒）

## Pitfalls
- **audiocraftは使わない**: 依存地獄。transformers の MusicgenForConditionalGeneration が楽で確実
- **Python 3.14ではtorch不可**: torch用は別venvで3.12/3.13を使う（uvが自動取得）
- **MusicGenは歌詞・ボーカル不可**（インスト専用）。歌付きは有料API(Suno等)→ユーザー確認必須(CLAUDE.md)
- MIDI経路の音色はGM音源なのでチープ。本格的な音色はAI経路かGarageBandで差し替え
- 生成後は必ず無音検証: `ffmpeg -i x.mp3 -af volumedetect -f null - 2>&1 | grep volume`

## Verification
- mp3が無音でないこと（mean_volume が -40dB より大きい）
- duration が指定秒数とほぼ一致
- 実測: lo-fi MIDI=58s/正常、MusicGen 8s=82sで生成・mean -26.6dB
