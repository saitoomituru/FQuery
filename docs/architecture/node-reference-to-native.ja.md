# Node referenceからnativeへの境界

Node.js / TypeScript版はFQueryの参照実装であり、semantic ABI正本ではない。Atlantis 1.x向けC++実装は同じfixtureから意味結果を比較できることを要求する。

Atlantis 1.xのABIとpackage resolver契約が未制定の間、`native/`は予約地およびconformance harness候補であり、native runtime実装済みとは表示しない。
