# Negative fixtures

cycle、plugin-not-found、semantic-unsatisfied、base構造不正、profile不適合等の境界fixtureを置く。

directory名の`negative`は「自然言語や解釈が悪い」という裁定ではなく、特定のstatus／停止／不適合経路を観測するtest分類である。`unknown`、`unconnected`、`not-evaluable`は単独では失敗でも規約違反でもなく、それらを`pass`や存在否定へ誤変換する経路をnegative caseとして扱う。
