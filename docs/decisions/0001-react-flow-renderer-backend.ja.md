# 0001: graph presentation surfaceをReact + React Flowへ交換する

Status: `ACCEPTED`（2026-09-08、human test合格をUserが確認し案Bを採用。Vue/Baklavaは撤去済み）  
Authority: FQuery Issue #36  
Branch: `agent/gui-react` → `main`

## 候補

| 案 | 内容 | 状態 |
|---|---|---|
| A | Vue 3 + BaklavaJS 2.8.1を維持し、renderer由来の補修をFQuery側で続ける | 現行`main` |
| B | React + React Flow（`@xyflow/react` 12）へrenderer backendを交換する | 採用。`main`へmerge |
| C | 別のnode editor library（Vue系／Svelte系等）へ交換する | 未検討 |

## 採用理由（Bを第一候補にする根拠）

- `74847c4`と`b4abed8`で、connection全破棄再生成、DOM実測によるport座標逆算、`ResizeObserver`によるedge追従がFQuery側へ入った。これはrendererが吸収すべき責務であり、保守ペインとして扱う
- React Flowはnode position、edge端点、pan／zoom、viewport、selection、drag、fit viewを自身で所有する
- React Flowをcontrolledで使い、accepted layoutを一方向投影するだけで、rejected時の位置復帰にrollback補正codeが不要になる（`@fquery/ui-react`の`DraftLayoutState`）
- React Flow、react、react-nativeはいずれもMIT。runtimeにclosed API依存は無い

普及度や市場規模は採用理由にしない。定規は上記2 commitが示す保守ペインである。

## 保持する非採用branch

- 案AはGit履歴（`7f22e4c`以前の`packages/ui-vue`と旧`apps/playground`）に残す。human test合格後に撤去した
- Baklava固有の知見（`node` slotのdragMoves不整合、`useBaklava()`のreactive editor経由）は`docs/specification/gui-presentation-contract.ja.md`にhistoricalとして残す

## 変えないもの

- `@fquery/ui-core`の`PresentationFam`／`NodeViewModel`／`ConnectionViewModel`／`GuiEventAbi`／`PresentationSession`
- `@fquery/core`、`@fquery/plugin-sdk`、`@fquery/hosts/*`
- GUIからModelを直接書かない。gestureは`*.requested`へ変換し、acceptedが返るまでcanonical確定扱いしない

## 差戻し条件

- React版でもFQuery側codeにDOM実測が必要になった場合は`SEMANTIC-STOP`とし、Vue削除を止める
- React Flowのcontrolled運用で、drag中の描画とaccepted layoutの再投影が両立しない場合

## 確認済み事項

- React FlowはDOM／SVG rendererであり、React Native上では動かない。React Native backendは`src/model/`（DOM非依存層）を共有した別adapterになる。Issue #36 Phase 4はこの前提で別Issueとする

## User Gate

- human test（`docs/testing/human-acceptance.ja.md` の「React Flow renderer比較」）の結果で、次のいずれかをUserが決める
  1. Vue/Baklavaを削除しReactへ一本化する（Phase 2以降へ進む）
  2. Issue #36をクライム失敗として閉じ、branchをhistoricalとして残す
  3. 別案（案C等）を検討する
