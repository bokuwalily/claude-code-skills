---
name: local-llm-slow-diagnosis
description: ローカルLLM(ollama等)がMac/ノートPCで異常に遅い(eval rate 1-2 t/s等)時の原因切り分け。"100% GPU"表示なのに遅い場合に発火。
author: auto
status: active
created: 2026-05-28
version: 1.1.0
disallowed-tools: Write Edit Agent
---

## Procedure
切り分けは「安く効く順」ではなく「最も見落とす順」で。電力を最後に回すと時間を溶かす。

1. `ollama ps` でPROCESSOR列確認。"100% GPU"でも遅いなら以下へ（GPU"割当"≠フルクロック）
2. メモリ切り分け: `memory_pressure | grep free`。他モデルを `ollama stop <model>` して再測定。変化なければメモリは無関係
3. バージョン: `ollama --version` と `gh api repos/ollama/ollama/releases/latest --jq .tag_name` を比較。更新しても変わらなければソフトは無関係
4. **電力(最重要・盲点)**: `system_profiler SPPowerDataType | grep -iE "Wattage|State of Charge"`
   - アダプタW数が低い(8W=iPhone充電器クラス)＋バッテリー低残量 → GPUスロットリング確定
   - Apple Siliconノートは給電不足/低バッテリー時にGPUクロックを絞る。AC接続でも起こる
5. 補助: `pmset -g | grep lowpowermode`（1なら低電力モード）、`pmset -g therm`（CPU_Speed_Limit<100でサーマル抑制）

## Pitfalls
- "100% GPU"はGPU割当の意味で、フルクロックの意味ではない。prompt eval も generation も両方遅いなら電力/熱を疑う
- ollamaバージョン更新やメモリ解放を先に試しがちだが、給電が原因なら全部無駄。電力確認を早める
- M5等の最新チップはアダプタ70W+必須。8-30Wでは高負荷時に破綻し、充電も追いつかずバッテリーが低残量で張り付く
- macOSのollamaは手動DMG。CLI更新は `brew install --cask --force ollama-app`(モデルは~/.ollamaに残り保持される)

## Verification
- アダプタを70W+に替え、バッテリー50%+まで充電後に `ollama run <model> --verbose "short task"` で eval rate 再測定
- 10倍以上改善すれば電力が原因だったと確定（実例: 8W時1.28 t/s → 68W時10.73 t/s）
