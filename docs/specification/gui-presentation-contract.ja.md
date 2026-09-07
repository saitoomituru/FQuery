# GUI Presentation contract

Status: `IMPLEMENTED-CONTRACT / SESSION-CONTROLLER / CORE-NODES / FAMVIM / NODE-PANEL / BAKLAVA-POC / HUMAN-TEST-WAIT`

Authority: FQuery Issue #23, #25, #27, #28  
Design source: ZeroRoomLab-manifest Issue #41 comment / Issue #44

## MVC境界

```text
Model
  = FAM / Presentation FAM / Proton.md / Host管理のlayout data

Controller
  = @fquery/ui-core
    - plugin presentation registry
    - GUI Event ABI
    - engine event / VEU projection
    - renderer fallback

View
  = @fquery/ui-vue
    - Vue 3
    - BaklavaJSは交換可能な第一候補adapter
```

GUIはFAMを実行するengineではない。Q、SIN、hash、divergence、vector similarity、connection ABIを計算せず、engineが返したstateを表示する。

## Presentation FAM

`fquery.presentation-fam/0.1.0-draft`は次を保持する。

- semantic `targetRef`
- surface
- `visualRole`
- interface role
- visibility／grouping
- renderer hint
- category／aliases
- opaqueな`layoutSlotRef`

pixel座標、size、zoom、viewport、local widget stateは保持しない。それらは`layoutSlotRef`が指すHost側adapterのデータであり、IBD、nested SQL、KV等の選択をGUI Coreへ固定しない。

## Plugin presentation

pluginのcapabilityとPresentation FAMを`PluginPresentationRegistry`へ登録する。Viewは登録情報からpalette、検索、inspector等を生成できる。

registry座標は`pluginId + capability`であり、複数providerが同じcapabilityを提供できる。semantic nodeがpluginを選択しておらず候補が複数ある場合、GUIは独断で一つを選ばず`plugin-selection-unresolved`のghostを表示する。

- rendererがhintを扱える: `native`
- rendererがhintを扱えない: semantic refを保った`generic`
- pluginが未ロード／消失: semantic nodeを消さない`ghost`

renderer固有componentやBaklava graph objectをFAM Core正本へ昇格しない。

## GUI Event ABI

GUI操作は直接Modelを書き換えず、`node.add.requested`、`node.move.requested`、`connection.add.requested`等のrequestへ変換する。接続結果はengine側から`accepted / rejected / unresolved`として返す。

`node.move.requested`の座標はwrite-back要求のpayloadでありPresentation FAMではない。Hostが`layoutSlotRef`の保存先へ反映する。

## Presentation Session

`PresentationSession`はGUI requestとengine判定の往復を保持するcontrollerである。

```text
GUI gesture
  -> GuiEventAbi request（pending）
  -> PresentationDecisionPort.decide()
  -> PresentationDecision（accepted / rejected / unresolved）
  -> acceptedのときだけstateへ反映
```

- `accepted`: node、connection、layout write-back、projectionをstateへ反映
- `rejected`: 理由付きdecision履歴として保持し、stateは変えない
- `unresolved`: portは`unconnected`のまま残す。`unconnected != failure`
- decision履歴はreceiptであり、GUIはこれを意味判定へ昇格しない
- `plugin.presentation.removed`はregistryから外し、既存nodeを`ghost`へ写像してdataを失わない

`createFixtureDecisionPort`はengine不在の環境（Playground、component test）向けで、port方向・node存在・plugin一意性など構造判定だけを行い、semantic／λ／Q判定は`unresolved`のまま返す。

## Core node contract

Authority: FQuery Issue #25

Node Editorの最小構成は、FAMの意味役割に沿った3標準nodeである。

```text
Ψ.NL Input   (core.psi.nl-input)      observation ->
∇φ.FAMVIM    (core.gradient.famvim)   psi -> fam ->
λ.NL Output  (core.lambda.nl-output)  fam -> manifestation
```

- GUI node typeをontology正本にしない。semantic roleは`ψ / ∇φ / λ`で固定する
- `Q`はcanonical FAM側に保持し、`NodeViewModel`へ複製しない
- 3 nodeは`pluginId: fquery.core`としてregistryへ登録するが、Coreはoptional pluginの追加でschemaを変えない
- pluginゼロで3 node graphを表示・接続できる
- Voice／Video／Sensor／RAG／API／Actuator等はoptional pluginとして別registrationで参加する
- 接続可否はportが判定する。`carries`はpresentation上のhintであり、GUIはこれで接続を裁定しない

## FAMVIM RAW FAM editor

Authority: FQuery Issue #28。編集primitiveは`@fquery/fam-edit`（Issue #27）。

`∇φ.FAMVIM`はpluginが無くてもcanonical FAMを直接編集できるuniversal fallbackであり、debug viewerではない。

```text
canonical FAM（Host／engineが保持）
  -> FQueryFamvim: path navigation / RAW text / validator / diff preview
  -> property.change.requested { property: "fam.patch", value: FamPatch }
     または { property: "fam.text", value: string }
  -> Host／engineがfam-editで適用し、受理・拒否・loss receiptを返す
```

- GUIはModelを書かない。patch requestをemitするだけで、適用はHost／engine責務
- 編集対象path以外を変更しない。unknown field／subtreeはround-tripで保持する
- `knownPointers`外のleafは`unsupported`として表示する。`unsupported != invalid`
- validator違反とparse失敗と編集可能性は別軸。validator違反でも編集requestは出せる
- malformed draftは失わず保持し、`fam.text` requestとしてHostへ渡す。Hostがrejectすればreceiptに残る
- FAMVIM独自schemaを持たない。`fam_id / revision_id / schema_version / provenance`はread-only表示
- validatorは注入する。`@fquery/fam-edit`はFAM Coreのschemaを所有しない

## Q-schema駆動Node Panelとlossless partial editing

Authority: FQuery Issue #27

pluginはFAM ontologyの所有者ではなく、特定Q schema／subtreeのpresentation + edit capabilityを提供する。`PluginPresentationRegistration.editor`（任意）で宣言する。

```text
editor:
  famRole        ψ | ∇φ | λ
  qSchema        /Q配下のkey -> { type: string|number|boolean|enum, enum?, readOnly? }
  knownPointers  Q以外で編集責務を持つcanonical pathのprefix
  capabilities   任意
presentation     Presentation FAM（presentation_schemaに相当）
```

`FQueryNodePanel`は次の5 tabを持つ。

```text
[設定]              nodeId / plugin / capability / famRole / projection
[接続]              port状態、確定済みconnection、切断request
[Q]                 qSchemaから生成。変更は /Q/<key> だけのfam.patch（set / insert）
[Unsupported Data]  panelが編集できないがcanonical FAMに存在するleaf path。RAWへjump可能
[RAW FAM]           FQueryFamvim埋め込み。knownPointers外をunsupportedとして表示
```

原則:

```text
unsupported != invalid
GUI controllerにない != dataが存在しない
unknown field != drop target
```

- known fieldだけをpatchし、unknown fieldはround-tripで保持する
- plugin A -> plugin B切替でもcanonical FAMは同一。認識fieldが入れ替わるだけ
- registrationが無い（ghost）nodeでもdataは保持され、RAW FAMで編集できる
- Panel／FAMVIMはModelを書かない。requestの採否とloss receiptはHost／engine責務
- GUI保存でcanonical FAMの未認識fieldが消えないことは`@fquery/fam-edit`のreceiptで検証する

## canvas内node本体とplugin renderer

Authority: FQuery Issue #23, #25, #27。概念の参考: `CREDITS.md`（ChatGraph、Blender）

node editorは付録ではなく全画面の主題であり、node本体に入力・出力・状態が同居する。node本体の中身はGUI Coreが固定せず、Presentation FAMの`rendererHint`に対応する**plugin renderer**が供給する。

```text
PresentationProjection.mode
  native   rendererHintに対応するrenderer componentをnode本体へ描画
  generic  rendererが無い／renderer非対応 -> generic card（badges / value要約 / inspect）
  ghost    plugin消失 -> generic cardにghost表示。dataは保持
```

- `FQueryBaklavaView`は`nodeRenderers: { [rendererHint]: Component }`を受け取り、`FQueryCanvasNodeContent`をBaklavaの非port interface（`setPort(false)`）として各nodeへ載せる。Baklavaの`node` slotは使わない（Baklava 2.8.1のdragMoves index不整合を避ける）
- rendererは`{ model: NodeViewModel, projection }`を受け取り、`FQueryUiEvent`をemitするだけでModelを書かない
- Core 3 node（`Ψ.NL` / `∇φ.FAMVIM` / `λ.NL`）は`fquery-core-node` hintの最初のrendererであり、pluginは同じ経路で自分のrendererを登録する
- adapterは`useBaklava()`が返すreactive editorへgraphを変更する。生のEditorへ追加するとmount後の変更が描画へ伝播しない
- Playgroundの構成: 全画面canvas、左上floating palette、右inspector drawer（Node Panel）、下端records drawer

## Selectionとslot式pane（Issue #33）

### active cursor node

Baklavaのclick／box select、outliner、inspectボタンはすべて`node.select.requested`へ変換され、sessionが`selection`（`activeNodeId` + `nodeIds`）として受理する。選択はGUI局所状態でありcanonical FAMではないため、engine判定を経由せず、存在しないnodeだけを落とす。`node.remove`で選択から外れ、activeは残りへ移る。`FQueryBaklavaView`はsession selectionをBaklavaへ反映する（正本はsession側）。

### PaneContribution

```text
PaneContribution {
  side:          "left" | "right"
  tab:           { id, title, icon?, order }
  section:       { id, title, order, collapsible? }
  componentRef:  Host／Viewが解決するkey（rendererHintと同じ経路）
  source:        "core" | "plugin:<id>" | "host"
  applies?:      (PaneContext) => boolean
}
PaneContext = { activeNode?, selection, registration?, projection?, famRole?, capability? }
```

- 同じ`tab.id`へ複数sourceがsectionをstackできる（Blenderの`bl_category`相乗り）。tab specは最小`order`の宣言を採用する
- plugin registrationは`editor.panes`（`PluginPaneContribution`、`appliesTo: own-node | any-node | always`）で宣言し、`PaneRegistry.registerPlugin`が取り込む
- `FQueryPane`はtab strip→section stack（折り畳み可）を描画し、`componentRef`が未解決ならsection宣言を保持したままfallbackを表示する
- 開閉・最終tab・折り畳みはper-viewerの便宜としてlocalStorageへ残す。graphの永続化ではない
- 左=Tool pane（Add Node / Records / Decisions、`T`）、右=Inspector pane（active nodeの詳細、`N`）。keyは入力中は無効
- sectionはModelを書かない。`FQueryUiEvent`をemitするだけ

参考: Blender HIG Sidebar Tabs、ComfyUI `registerSidebarTab`、Unreal `IDetailCustomization`、Node-RED `RED.sidebar.addTab`、n8n Parameters/Settings（`CREDITS.md`）

## Engine event / VEU

`fam.node.changed`、`source.diverged`、`q.changed`、`abi.mismatch`、`implementation.unavailable`等をnode/ref単位で投影する。変更対象外nodeのobject identityを保持し、全graph再構築を要求しない。

GUIはeventのstateを再計算・再裁定しない。

## BaklavaJS境界

`@fquery/ui-vue`はBaklavaJS 2.8.1の`core`、`renderer-vue`、`themes`をnode-editor surfaceとして利用する。`@baklavajs/engine`は導入しない。Baklavaのgraph JSONをcanonical保存形式にせず、確定済み`NodeViewModel`とconnectionを一方向投影する。

connection gestureは`connection.add.requested`としてengineへ返し、Baklava側だけでは確定しない。node移動も`node.move.requested`としてHostへ返し、layout storeから確定値が返るまでは元位置へ戻す。

BaklavaJS 2.8.1のCommonJS entryとESM-only `uuid`にはNode test上の互換問題があるため、Vitestだけ公式ESM entryへ解決する。vendor型exportのNodeNext差分は`baklava-renderer-vue-compat.d.ts`へ隔離する。Browser buildのruntime contractは変更しない。

## 検証境界

- contract／registry／fallback／局所更新: automated unit test
- Vue projection: component test
- Baklava操作性、Blender系UX、VS Code／Sphere Runner: human test
- layoutの実IBD永続化: integration test
