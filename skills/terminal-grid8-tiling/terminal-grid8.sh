#!/bin/bash
# terminal-grid8.sh — Terminal.app の窓をウルトラワイド画面に 4x2 の8等分グリッドで整列する
# 使い方: terminal-grid8.sh
# 仕組み: Swift で対象画面(最も横長)の visibleFrame を取得 → AppleScript の収束ループで
#         画面上の Terminal 窓を空きセルへ順に配置。名前参照はスピナー回転で失効するため
#         毎パス index 再スキャン + 即時操作。set間 delay 必須(無いと position が無視される)。
# 正典メモリ: reference_terminal_window_tiling
set -euo pipefail

COLS=4
ROWS=2

# --- 対象画面のグローバル座標(左上原点)を取得: "x y w h" ---
GEOM=$(swift - <<'EOF'
import AppKit
let screens = NSScreen.screens
guard let main = screens.first else { exit(1) }
// 最も横長の画面を対象にする(ウルトラワイド)。同率ならメイン以外を優先
let target = screens.max(by: { $0.frame.width < $1.frame.width })!
let v = target.visibleFrame   // Dock除外(Cocoa座標: 左下原点Y上向き)
let mainH = main.frame.height
var topY = mainH - (v.origin.y + v.height)  // グローバル(左上原点)座標へ変換
var h = v.height
// visibleFrameがメニューバーを反映しない画面がある(実測: AXはtop+30にクランプ)→手動で差し引く
if v.height == target.frame.height {
    topY += 30
    h -= 30
}
print("\(Int(v.origin.x)) \(Int(topY)) \(Int(v.width)) \(Int(h))")
EOF
)
read -r GX GY GW GH <<< "$GEOM"
echo "target screen (visible): x=$GX y=$GY w=$GW h=$GH"

CW=$(( GW / COLS ))
CH=$(( GH / ROWS ))
echo "cell: ${CW}x${CH}"

osascript - "$GX" "$GY" "$CW" "$CH" "$COLS" "$ROWS" <<'EOF'
on run argv
  set gx to (item 1 of argv) as integer
  set gy to (item 2 of argv) as integer
  set cw to (item 3 of argv) as integer
  set ch to (item 4 of argv) as integer
  set nCols to (item 5 of argv) as integer
  set nRows to (item 6 of argv) as integer
  set tol to 40
  set nCells to nCols * nRows

  -- セル左上座標のリスト(行優先)
  set cellX to {}
  set cellY to {}
  repeat with r from 0 to (nRows - 1)
    repeat with c from 0 to (nCols - 1)
      set end of cellX to gx + c * cw
      set end of cellY to gy + r * ch
    end repeat
  end repeat

  tell application "System Events"
    tell process "Terminal"
      -- 収束ループ: 毎パス再スキャンして未配置の窓を1枚だけ動かす
      repeat with pass from 1 to (nCells * 3)
        set occupied to {}
        repeat nCells times
          set end of occupied to false
        end repeat
        set moverIdx to 0
        set n to count windows
        -- 1) 対象画面上の窓を走査し、セル一致済みをマーク・最初の未配置窓を記録
        repeat with i from 1 to n
          try
            set p to position of window i
            set px to item 1 of p
            set py to item 2 of p
          on error
            set px to -99999
            set py to -99999
          end try
          -- 対象画面内か(窓の左上がvisibleFrame内)
          if px ≥ (gx - tol) and px < (gx + nCols * cw) and py ≥ (gy - tol) and py < (gy + nRows * ch) then
            set matched to false
            repeat with k from 1 to nCells
              if (not (item k of occupied)) and (px - (item k of cellX)) < tol and ((item k of cellX) - px) < tol and (py - (item k of cellY)) < tol and ((item k of cellY) - py) < tol then
                set item k of occupied to true
                set matched to true
                exit repeat
              end if
            end repeat
            if (not matched) and moverIdx = 0 then set moverIdx to i
          end if
        end repeat
        -- 2) 未配置窓が無ければ収束
        if moverIdx = 0 then exit repeat
        -- 3) 最初の空きセルへ移動 (size→position→size、delay必須)
        set freeCell to 0
        repeat with k from 1 to nCells
          if not (item k of occupied) then
            set freeCell to k
            exit repeat
          end if
        end repeat
        if freeCell = 0 then exit repeat -- 窓が9枚以上: 余りは放置
        set tx to item freeCell of cellX
        set ty to item freeCell of cellY
        try
          set size of window moverIdx to {cw, ch}
          delay 0.2
          set position of window moverIdx to {tx, ty}
          delay 0.2
          set size of window moverIdx to {cw, ch}
          delay 0.2
          -- 読み返して position を最終補正(リサイズでのドリフト対策)
          set p2 to position of window moverIdx
          if (item 1 of p2) is not tx or (item 2 of p2) is not ty then
            set position of window moverIdx to {tx, ty}
            delay 0.2
          end if
        on error
          delay 0.3 -- スピナー等の過渡エラーは次パスで再試行
        end try
      end repeat

      -- 最下段yの正規化: 実高(行丸めでセル高を超える)のクランプ揺れで y が混在するため、
      -- 実高を読み取って下端揃えに統一する
      set bottomEdge to gy + nRows * ch
      set lastRowTop to gy + (nRows - 1) * ch
      repeat with i from 1 to (count windows)
        try
          set p to position of window i
          set px to item 1 of p
          set py to item 2 of p
          if px ≥ (gx - tol) and px < (gx + nCols * cw) and py ≥ (lastRowTop - tol) and py < bottomEdge then
            set s to size of window i
            set wh to item 2 of s
            set targetY to bottomEdge - wh
            set bestX to px
            repeat with c from 0 to (nCols - 1)
              set cx to gx + c * cw
              if (px - cx) < tol and (cx - px) < tol then set bestX to cx
            end repeat
            if (px is not bestX) or (py is not targetY) then
              set position of window i to {bestX, targetY}
              delay 0.2
            end if
          end if
        end try
      end repeat

      -- 最終レポート
      set out to ""
      repeat with i from 1 to (count windows)
        try
          set p to position of window i
          set s to size of window i
          set out to out & (item 1 of p) & "," & (item 2 of p) & " " & (item 1 of s) & "x" & (item 2 of s) & "  " & (name of window i) & linefeed
        end try
      end repeat
      return out
    end tell
  end tell
end run
EOF
