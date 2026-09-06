# GUI Presentation contract

Status: `IMPLEMENTED-CONTRACT / BAKLAVA-POC / HUMAN-TEST-WAIT`

Authority: FQuery Issue #23  
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
