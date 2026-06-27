---
name: local-ai-video-pipeline
description: 無料ローカルでAI動画を作る時（静止画→動画クリップ→連結）。ComfyUI/RealVisXL静止画にffmpegでKen Burnsモーションを付けて繋ぐ。ffmpegがbashのwhile-readループのstdinを食う罠に当たった時も。
author: auto
created: 2026-06-20
version: 1.0.0
---

## Procedure

実装正典: `~/dev/ai-video-factory`（07-pc-automation）。`generate.sh scenes/x.txt [--bgm f] [--fps 30]`。

構成（流用可）:
1. **静止画**: `lib/comfy_txt2img.py "<prompt>" out.png [seed]` — ComfyUI API(127.0.0.1:8188)/RealVisXL V5.0/1344x768。先に `cd ~/dev/comfyui && .venv/bin/python main.py --port 8188 &`。初回~145秒。
2. **モーション(Tier1・追加DL不要)**: `lib/kenburns.py still.png clip.mp4 [dur] [fps] [motion] [W] [H]` — ffmpeg zoompanでパン/ズーム。motion=zoom_in|zoom_out|pan_left|pan_right|pan_up|pan_down|auto。
3. **モーション(Tier2・opt-in)**: `lib/svd_img2vid.py still.png clip.mp4` — SVD img2vid(本物の生成モーション)。要 `svd_xt.safetensors` 9.5GB(未DLなら手順表示で停止)。MPSで数分/クリップ。
4. **連結**: `lib/stitch.py out.mp4 clip1 clip2 ... [--bgm f] [--xfade 0.6]` — xfadeクロスフェード＋BGMはloudnorm整音+末尾フェード。

シーン定義(1行1シーン): `<英語prompt> :: <秒> :: <motion>`（`::`以降省略可・`#`コメント）。

## Pitfalls

- **🔴 ffmpegがwhile-readのstdinを食う**: `while read line; do ffmpeg ...; done < file` だと ffmpeg が標準入力からfileの残り行を読み取り、1呼び出しごとに1行飛ぶ（2行目以降が欠落）。**必ず `ffmpeg -nostdin ...`**（または `</dev/null`）。subprocessでも同じ。これが今回の主因だった。
- **zoompanのジッター/crop失敗**: プリスケールがcropサイズ未満だと "Invalid too big or non positive size"。`scale={W*2}:{H*2}:force_original_aspect_ratio=increase,crop={W*2}:{H*2}` で出力比2倍へ拡大してからzoompan、で両方解決。
- **ComfyUI 8188 残存プロセス衝突**: `lsof -nP -iTCP:8188 -sTCP:LISTEN -t | xargs kill -9`。
- **SDXLは日本語不可**: テロップは後段でPIL等で乗せる（senior-tube方式）。
- **配信用BGM**: 権利フリーのみ（music-labの自作MIDI等）。AI生成物は「AI生成」と明示。実在人物なりすまし・アダルト量産はやらない。

## Verification

- `ffprobe -v error -show_entries format=duration:stream=width,height,nb_frames -of default=noprint_wrappers=1 out.mp4`
- 尺の検算: xfade連結の総尺 = Σdur − (clips−1)×xfade。例 4+3.5+4 − 2×0.6 = 10.3s。
- 静止画はReadで目視（ダミー/壊れでないか）。全シーン数=stills数=clips数を確認（ffmpeg stdin罠の検出）。
