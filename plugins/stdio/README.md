# @fam/stndio

refFAMの`Q.plugin`が参照する、OS/protocol中立の基本file read capability(`file.fit`)実装です。Cのstdioと同じ位置づけの最小I/O提供であり、FQuery Core固有の意味論は持ちません。

命名は`@fquery/*`(FQuery自身のNode参照実装package)とは意図的に別の`@fam/*`名前空間を使います。refFAM/Q.pluginはFQueryに限らずFAM/refFAMを話す任意のQuery実装から参照され得るため、pluginのcapability名前空間はFQuery実装へ縛られません(詳細: `docs/specification/fam-q-declaration-execution.ja.md`)。

## 提供capability

- `file.fit(patterns: string[])`: `baseDir`起点で単一path segment内の`*`/`?`ワイルドカードだけをサポートする最小globでファイルを探索し、JSON parse + FAM base構造(ψ/∇φ/λ/Q)検証結果込みで返す。

## 非対応(明示)

- 再帰glob(`**`)
- symlink追跡
- decomposition profile等、base構造を超えた検証
