# Status / Last Order / bottom / unconnected

## 原則

```text
API success != Q success
plugin exists != port connected
unconnected != failure
transport success != lambda satisfied
unknown != pass
reference resolved != semantic truth
multiple references != wisdom proof
```

状態は単一enumではなく直交軸で保持する。これにより「plugin callは成功したが目的未達」「capabilityはあるがport未接続」「接続はないがエラーではない」「FAM refは解決したが内容の真偽は未評価」を表現できる。

FAM自体の受理でも、次を分離する。

| Axis | 問い | 例 |
|---|---|---|
| `base_structure_status` | 最小`ψ / ∇φ / λ / Q`構造として読めるか | `valid`, `invalid` |
| `profile_conformance` | 選択した拡張profileの要求を満たすか | `not-evaluated`, `satisfied`, `not-satisfied`, `not-evaluable` |
| `artifact_role` | OAE / FAMLog / FAMJSON / refFAM等のどの役割として観測されたか | profile固有、`unknown` |
| `reference_status` | 独立FAM identity / revisionを解決できるか | `not-requested`, `resolved`, `unresolved`, `unavailable` |
| `service_negotiation` | 要求したplugin／adapter／socketを使えるか | `not-requested`, `resolved`, `unavailable` |
| `observer_verdict` | 指定OAE rule下でObserverが何と評価したか | rule固有語彙、`indeterminate` |

`artifact_role`をCore closed enumへ固定しない。追加fieldやprofile fieldの欠落を`base_structure_status=invalid`へ短絡させない。

相反する`observer_verdict`は別OAEとして併存でき、一つの採用scopeから他recordの削除を導出しない。

## FAMJSON / FAMLog / refFAMの状態境界

```text
4-axis readable
!= FAMJSON promoted

FAMJSON promoted
!= refFAM

shared reference detected
!= truth
!= authority
!= pure wisdom
```

単発の観測・所感・操作traceはFAMLog / OAE candidateとして保持できる。

別Contextから再参照され、独立identityが必要になった場合は`artifact-promotion-candidate`等のeventを経てFAMJSON / Infotonへ昇格できる。

factを含むartifactをrefFAMへ無断昇格させない。refFAM candidateであるかはactive profile / Observerの評価対象であり、base validatorの責務ではない。

## FAM reference status

Fold boundaryが`fam_ref`を持つ場合、次を独立して観測する。

```text
reference identity exists
revision policy resolved
referenced artifact loaded
runner dispatch succeeded
semantic result satisfied
```

これらを一つの`success`へ潰さない。

例:

```text
fam_ref exists
reference_status = resolved
transport_status = succeeded
semantic_status = unknown
```

は合法。

参照先が無い場合も、parent FAMを破壊せず`reference_status=unavailable`とLast Orderを返せる。

## 遷移

| Event | 変更する軸 | 禁止する暗黙遷移 |
|---|---|---|
| input bind成功 | `resolution_status=resolved` | `lambda_status=satisfied` |
| output未配線 | `connection_status=unconnected` | `control_status=bottom` |
| plugin発見 | `plugin_status=resolved` | `connection_status=connected` |
| transport成功 | `transport_status=succeeded` | `semantic_status=satisfied` |
| verifierが目的未達を確認 | `semantic_status=semantic-unsatisfied`, `lambda_status=unsatisfied` | transport failureへの書換え |
| 情報不足 | 対象軸=`unknown` | pass／failureへの推測 |
| 拡張profile field不足 | `profile_conformance=not-satisfied`または`not-evaluable` | `base_structure_status=invalid` |
| FAM ref解決成功 | `reference_status=resolved` | `observer_verdict=matched` / `artifact_role=refFAM` |
| FAM ref解決不能 | `reference_status=unavailable`, `control_status=last-order` | parent FAM削除 / child不存在のglobal fact化 |
| shared ref検出 | extraction / portability candidateを生成 | wisdom / truth / authorityへの自動昇格 |
| adapter不在 | `service_negotiation=unavailable`, `control_status=last-order` | 想像によるtransport成功への置換 |
| 相反するObserver評価 | 別OAEとして両方を保持 | 多数決／最新値によるglobal truth化 |
| cycle | `resolution_status=bottom`, `control_status=bottom` | Last Orderへの無条件昇格 |
| resource limit | `control_status=last-order` | resultへの縮退 |

Last Orderは現在routeで継続できない理由、要求する次判断、再開条件をenvelopeとして返す。例外messageだけへ縮退させない。

関連: [`fam-reference-boundary.ja.md`](fam-reference-boundary.ja.md)、[`fold-boundary-runner.ja.md`](fold-boundary-runner.ja.md)
