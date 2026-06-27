---
name: youtube-competitor-decompose
description: 競合YouTubeチャンネルを韓国大手YouTuber式に要素分解したい時に発火。yt-dlp（APIキー・クォータ不要）でタイトル文字数/動画長/投稿時間帯/タグ/再生分布を機械抽出し、サムネ等のvision次元は別途補完。shukatsu-navi等のSEO競合調査・ジャンル参入前の偵察に使う。
author: auto
created: 2026-06-09
version: 1.0.0
---

# YouTube競合分解（yt-dlp / キー不要）

韓国大手YouTuberの「競合10チャンネルを要素分解しろ」を機械化する。
取得できる次元は自動集計、できない次元（サムネ・BGM・フック）は明示して2層で埋める。

## Procedure

1. **機械抽出（自動）**
   ```bash
   python3 ~/.claude/skills/auto/youtube-competitor-decompose/scripts/decompose.py "@ChannelHandle" 15
   ```
   - 第1引数: `@ハンドル` か フルURL（`https://www.youtube.com/@x/videos`）
   - 第2引数: 分析本数（既定15、直近N本をフル抽出→再生数降順）
   - 出力: 個別動画テーブル（再生/いいね/長さ/タイトル/タグ数）＋集計シグナル
     （タイトル文字数中央値・動画長中央値・投稿時間帯TOP3・頻出タグTOP15）

2. **複数チャンネル比較**: 同コマンドを各競合に走らせ、出力markdownを並べて差分を読む。
   注目点 = タイトル文字数の収束値 / ショートかロングか / 投稿時間帯の集中 / タグ戦略。

3. **vision次元の補完（手動・任意）**: サムネを落としてビジュアル分析する。
   ```bash
   yt-dlp --write-thumbnail --skip-download -o "thumb_%(id)s" "https://youtu.be/VIDEO_ID"
   ```
   落としたサムネをReadで読み、明るさ・文字配置・文字数・被写体を比較（韓国式の核心）。

4. **自分の設計に落とす**: 抽出した収束値（例: タイトル28字前後・夜20時投稿・ロング8時間）を
   自チャンネル/記事のテンプレに反映。AIに丸投げせず、癖を上書きする（韓国式11〜14条）。

## Pitfalls

- `--flat-playlist` は **view_count を返さない**（None）。必ずフル抽出してから再生数ソートする。
  →本スキルのスクリプトは直近N本をフル抽出する方式で回避済み。
- 大手チャンネルは **tags非公開**（タグ数0表示）。タグ戦略は中小競合でしか読めない。
- 投稿時間帯は実行マシンのローカルTZ（JST）基準。海外チャンネル比較時は時差に注意。
- フル抽出は1本=1 yt-dlpプロセス。本数を増やすと線形に遅くなる。偵察は15本で十分。
- ハンドルが架空/誤記だと無言で0件になる。0件時はハンドルを実在URLで再確認する。

## Verification

- `@MrBeast 4` で実行 → 再生数・タイトル文字数中央値・動画長中央値・投稿時間帯が出れば正常。
- 0件が出たら: (a) ハンドル実在確認、(b) `yt-dlp --version`、(c) ネットワーク/レート制限を疑う。
