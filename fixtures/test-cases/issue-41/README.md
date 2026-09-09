# Issue #41 long-source semantic topology fixture

UserがHuman Testで提示した原文と、同時に成立候補となる二つのsemantic topologyを保存する。

- `source.ja.txt`は入力原文であり、自然言語の正誤をvalidatorが裁定する対象ではない
- `semantic-topology.case.jsonc`はHuman Observerが提示した期待構造をunit orderで記録するtest caseであり、global truthを主張しない
- fact-domain branchとAstral branchは非ゼロサムで、片方の採用が他方の削除を意味しない
- 自動testは意味内容の正しさではなく、branch保持、mL鎖、nested Fold、root直結禁止を検査する
- OAE参照はvolatileな候補であり、IBD永続化済みOAEを名乗らない
