# FAM参照境界 Human Acceptance

状態: `NOT-RUN / DESIGN-CORRECTIVE`

対象仕様: [`../specification/fam-reference-boundary.ja.md`](../specification/fam-reference-boundary.ja.md)

## 目的

Foldを同一FAM内のhidden child graphとして扱わず、独立FAM identityへの参照境界として実装できていることをHuman Testで確認する。

自動test greenだけで合格にしない。

## Test 1: Fold extraction

入力FAMを分解し、一部をFold化する。

確認:

- parent RAW FAMとchild RAW FAMが別documentとして確認できる
- childに独立`fam_ref` / `revision_ref`がある
- parent側はchild内部nodeのcopyではなくreference boundaryを持つ
- extraction前後でunknown field、provenance、source textが失われない
- FAMLog / OAEにextraction receiptが残る

## Test 2: Fold close

開いているchild Foldで`まとめる-Fold-`を実行する。

確認:

- child内部projectionだけがcanvasから消える
- child FAMそのものはRAW / registryから取得できる
- child revisionが変化しない
- parent referenceが残る
- Fold closeをsemantic deletionとしてFAMLogへ記録しない

## Test 3: DeFold reopen

閉じたFoldを`ひらく-DeFold-`する。

確認:

- 同じ`fam_ref`がresolveされる
- close前と同じchild revisionを表示する（revision policyがpinnedの場合）
- childをparent JSONへinline copyしない
- node identity / edge / Q / provenanceが維持される

## Test 4: recursive DeFold

child FAM内のFoldをさらに開く。

```text
FAM-A
  -> FAM-B
       -> FAM-C
```

確認:

- A/B/Cが別FAM identity
- G表示がcross-FAM reference pathを反映する
- Cを閉じてもB/Aが壊れない
- Bを閉じてもC record自体は削除されない

## Test 5: shared ref

同一child FAM-Xを2つのconsumerから参照する。

```text
Fold-A -> FAM-X
Fold-B -> FAM-X
```

確認:

- FAM-Xが二重copyされない
- A/Bから同じFAM identityをresolveできる
- A側のpresentation state変更がB側のsemantic contentを書き換えない
- A/Bで別Access Mapper / Observer interpretationを使ってもFAM-Xのsourceを無断変更しない

## Test 6: fact / refFAM分離

例:

```text
りんごが落ちた
```

を通常FAMとして扱い、Qに観測根拠を付ける。

別に:

```text
なぜ？
他でも試す？
条件を変える？
別Observerでも追試する？
```

をrefFAM candidateとして扱う。

確認:

- factをrefFAMの正解表へ移動しない
- refFAMがfactの真偽を自動証明した表示にならない
- 通常FAMのQ evidenceとrefFAM methodが別artifactとして参照できる

## Test 7: portability without wisdom promotion

複数箇所で使われる経験則・合意logを用意する。

確認:

- 複数参照を検出して独立FAM extraction candidateにできる
- `shared == wisdom`と自動表示しない
- fact / consensus / business ruleを含む場合は通常FAMのまま保持できる
- HumanがrefFAMへ抽象化する場合は別revision / artifactとして作れる

## Test 8: unreferenced observation

一回だけの所感・観測recordを作る。

確認:

- FAMLog / OAE candidateとして残せる
- 4軸shapeがあるという理由だけでInfoton / refFAMへ自動昇格しない
- 後に別Contextから再参照された時、独立FAMへpromoteするcandidate operationを選べる

## Test 9: migration

legacy nested subtreeを新reference boundaryへmigrationする。

確認:

- source revisionが残る
- extracted child FAM identityが新規発行される
- parent before/after差分を確認できる
- unknown fieldsを保持する
- migration loss statusが表示される
- failure時に旧documentを破壊しない

## Test 10: provider flat / nested bias

ランダムまたは未知sourceをLLM providerで分解する。

確認:

- 全unit root fan-outだけを成功にしない
- 逆にnode数・階層深度を増やすだけでも成功にしない
- portable semantic boundaryが見つかった場合、独立FAM extraction candidateへ送れる
- candidateをHumanが修正できる

## 合格状態

```text
AUTOMATED-REFERENCE-CONTRACT-PASS
!=
HUMAN-REFERENCE-BOUNDARY-PASS
```

Human合格にはTest 1〜10の実ブラウザ確認と、少なくとも一件のshared ref、recursive ref、legacy migrationの観測receiptを要求する。
