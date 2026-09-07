# 人間テスト引継ぎ票

状態: `HUMAN-TEST-WAIT`

自動検証は型、状態軸、イベント配送、fixture描画、buildまでを対象にする。以下は人間が実画面と実Hostで判断するまで完了扱いにしない。

## Vue component

- `unknown`、`bottom`、`last-order`、`plugin-not-found`、`semantic-unsatisfied`が色だけに依存せず識別できる
- `unconnected`がerrorに見えず、`plugin-not-found`と混同しない
- keyboardだけでinspect、preview、execute、cancelへ到達できる
- 長いquery ID、Last Order、evidence参照でも崩れない
- `npm run dev`で`http://127.0.0.1:3000`を開き、hero、route controls、Q nodeが意図した配置で見える
- ProviderをFixture、Gemini、Ollamaへ切り替えると、それぞれ独立したmodel候補が表示される
- 自然言語を分解し、入力言語の再帰的な `ψ / ∇φ / λ / Q`、`Q.unknowns`、provider/model/plugin revisionが読める
- 他言語の写本が正本を置換せず `λ.sub_splitters` にあり、翻訳誤差が`not-evaluated`または測定receiptとして追跡できる
- 旧 `blocks[]` 候補がFAM paneへ表示されない
- Gemini routeでBrowserのNetwork payload／画面／consoleへcredentialの`key / secret`が出ず、表示用`name`だけが見える

## Node Editor（Issue #23 / #25 / #27 / #28）

automated testはSession判定往復、Core 3 node契約、fam-edit round-trip、component描画までを検証済み。以下は人間が実画面で判断する。

### 全画面canvasとnode本体

- `npm run dev`起動直後、画面全体がcanvasで、hero画像やdropdown主体の画面が無い
- `Ψ.NL` node本体にsource textarea、decomposer（provider）／model select、「分解を実行」がある
- `∇φ.FAMVIM` node本体に分解後のFAM要約（title / fam_id / units / unknowns）と「RAW編集 / Unsupported Data」がある
- `λ.NL` node本体に分解後のmanifestation行が`fixture-projection`として出て、λ badgeは`unknown`のまま
- 左上のpaletteと右のInspector drawer（topbarのInspectorボタン）がcanvasに重なり、canvasの操作を妨げない
- node本体のtextarea／selectを操作してもnodeがdragされず、canvasがzoomしない
- 下端の「Records」drawerを開くとFAM／provider receipt／debug／decisionsが補助表示として読める

### Core graph

- pluginを一つも追加せずに`Ψ.NL → ∇φ.FAMVIM → λ.NL`の3 nodeがcanvasへ並び、2本の接続が見える
- `λ.NL`の`manifestation` portだけが`unconnected`として点線表示され、errorに見えない
- Session decisions paneに`node.add` / `connection.add` / `node.move`が`accepted`として時系列で並ぶ
- Paletteで「Core」「FAMVIM」「ψ」などを検索すると3 nodeが候補に出て、追加すると4 node目が現れる

### Baklava操作

- nodeをdragすると`node.move.requested`がSession decisionsへ`accepted`として記録され、位置が保持される
- `λ.NL:fam`から`Ψ.NL:observation`へ逆向きにdragすると接続が確定せず、decisionが`rejected — port-direction-mismatch`と読める
- 同じinput portへ2本目を繋ぐと`rejected — input-already-connected`になる
- 接続が拒否された後もnodeとportが消えない

### FAMVIM / Node Panel

- 自然言語を分解した後、Node panelが`∇φ.FAMVIM`を対象にし、RAW FAM tabでcanonical FAMの全文が読める
- path navigationで`/λ/output_units/0/ψ/source_text`などを押すとtextareaの該当行が選択される
- RAW textを1箇所書き換えるとdiff previewに`replaced`が1件だけ出て、他のpathが出ない
- 「編集をrequest」後、FAM record paneの内容が更新され、FAM edit receiptsに`applied ops=1 touched=/λ/purpose`のように読める
- 編集前後で`x-plugin-extension`のような未知fieldがFAM record paneから消えない
- textを壊してrequestすると`draft unparsed（保持中）`が表示され、Session decisionsに`rejected — fam-text-unparsed`が残り、canonical FAMは前の状態のまま
- `ψ`を丸ごと削除してrequestすると、validatorが`axis-required`を出しつつ編集自体は通り、FAMVIM nodeのsemantic badgeが`semantic-unsatisfied`になる（editableとvalidが別軸）
- Unsupported Data tabにpanel外のpathが列挙され、「RAWへ」でRAW tabへ切り替わり該当pathが選択される
- Node panelの「接続」tabで`切断をrequest`すると接続が消え、portが`unconnected`へ戻る
- Node viewerで`Ψ.NL`の`inspect`を押すとNode panelの対象が切り替わり、`fquery.core@0.1.0-draft`が設定tabに出る
- 各tab、path button、「編集をrequest」までkeyboardだけで到達できる

### 意味境界の確認

- `accepted`はGUI操作が確定しただけで、semantic badgeは`unknown`のまま昇格していない
- `unresolved`のdecisionがある場合、portが`unconnected`のまま残り、errorとして描画されない
- 縦型FAM（`ψ / ∇φ / λ / Q`）がFAM paneの主表示で、provider receiptとdebug eventが補助paneに分かれている

## Host

- VS Code Webviewの実APIでeventがextension側へ一度だけ届く
- Sphere Runnerの実portで同じcomponentとprotocol revisionを共有できる
- 不正なruntime messageが画面状態を破壊しない

## 記録

実施時はOS、runtime、Host version、commit、スクリーンショットまたは操作記録、合否、残課題をIssue #5へ記録する。provider交換と自然言語FAM分解はIssue #19にも結果を反映する。Node Editor／FAMVIM／Node Panelの結果はIssue #23 / #25 / #27 / #28へ反映する。

自動snapshotはhuman visual reviewの代用にしない。
