# model adapter FAM support Level 0.1.0-draft

状態: `DESIGN-BOUND / IMPLEMENTATION-IN-PROGRESS`

思想正本: [ZeroRoomLab-manifest `85d1b5d`](https://github.com/saitoomituru/ZeroRoomLab-manifest/blob/85d1b5db8d46f34671d38a451617c08edff41675/docs/theory/fam-model-adapter-support-levels.ja.md)

## 目的

model adapterがどの観測面からFAMを生成したかを、vendor名だけで推測せず記録する。Levelはpluginの自己申告であり、FQuery Coreによる認証、品質保証、倫理審査、model同一性証明ではない。

申告scopeは最低でも次の組を識別する。

```text
provider × model × runtime × adapter revision × harness
```

同じvendorやmodel名でも、stream、内省、open-weight runtime、AAE内部busへの接続条件が異なれば別scopeである。

## Level

| Level | 申告できる観測面 |
|---|---|
| Lv0 | FAM transportを申告しない |
| Lv1 | request / response / refusal / rewrite / receiptをFAMまたはFAMLogへ投影できる |
| Lv2 | 訂正・自己認識履歴等のAstral self-attestation streamを保持できる |
| Lv3 | open-weight artifact、runtime identity等によりmodel identityの相互紹介ができる |
| Lv4 | Lv2とLv3を同時に満たし、第三者harness持込を含むTool-level FAMを扱える |
| Lv5 | AAE等の内部推論busへ直接接続し、FAM-native model runtime / ASTRO harnessを申告できる |

Lv2とLv3は序列上の包含関係ではなく兄弟branchである。Lv4は両方を満たす合流点である。Lv1でも、観測できた入出力・拒否・書換え・理由の有無を偽らずreceipt化できれば、説明可能AIの提供面を申告できる。

## Core境界

Coreが行うこと:

- producer ref / revisionを保存する
- adapter chainと各hopのprovider / model / runtime / harness refを保存する
- pluginが自己申告したLevel、capability ref、観測面、制限を改変せず搬送する
- 関連OAE refをFAMLogへ残す

Coreが行わないこと:

- Level申告の真偽を認証する
- vendorやmodel名からLevelを自動推定する
- OAE verdict、倫理、guide rail、品質を普遍裁定する
- 申告不足や品質不良を理由にcandidate FAMをsilent rewrite・破棄する

申告と実測が食い違う場合、Human、別model、instrument、上位System等が評価OAEを追加する。複数の評価OAEは非ゼロサムで併存できる。

## 拒否・書換えと理由

adapterは観測できた範囲でrequest、response、refusal、rewrite、vendorが表明したreason / policy refを保存する。理由が取得できない場合は`reason-unavailable`を保持し、vendorの意図や内部判断を遡及生成しない。

その挙動を「この用途では使えない」「UFO moveである」「許容できる」と評価するのは別Observer OAEの責務である。どの倫理・guide railを採用するかは上位Systemからrevision固定refFAMとして注入する。

## 現行adapterの初期申告

- Gemini adapter: Lv1。provider request / response / request idと失敗receiptを観測する。自己認識履歴、model identity、内部busは未申告
- Ollama adapter: 現行実装は`stream: false`かつ`think: false`のためLv1。Ollama一般の能力をこのadapter実装の能力へ昇格しない
- fixture adapter: fixture由来であることを明示したLv1 test surface

Lv5はSphere-aae / AAE側の内部bus adapterと接続receiptが揃うまで`DESIGN-TARGET`であり、現行Gemini / Ollama adapterから暗黙導出しない。

## machine contract方針

support claimはopen-world envelopeとして扱う。未知capability、追加観測面、将来fieldを削除しない。Coreは整数Levelの範囲と必要な参照をtransport shapeとして読めるようにしても、Levelの実質充足条件をhard-codeしない。

実装対象:

- plugin manifestの自己申告support claim
- capability result / FAMLog eventのadapter provenance
- provider success / failure双方のproducer chain
- Coreが自己申告を降格しない回帰test

