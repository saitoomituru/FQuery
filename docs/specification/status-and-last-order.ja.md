# Status / Last Order / bottom / unconnected

## 原則

```text
API success != Q success
plugin exists != port connected
unconnected != failure
transport success != lambda satisfied
unknown != pass
```

状態は単一enumではなく直交軸で保持する。これにより「plugin callは成功したが目的未達」「capabilityはあるがport未接続」「接続はないがエラーではない」を表現できる。

## 遷移

| Event | 変更する軸 | 禁止する暗黙遷移 |
|---|---|---|
| input bind成功 | `resolution_status=resolved` | `lambda_status=satisfied` |
| output未配線 | `connection_status=unconnected` | `control_status=bottom` |
| plugin発見 | `plugin_status=resolved` | `connection_status=connected` |
| transport成功 | `transport_status=succeeded` | `semantic_status=satisfied` |
| verifierが目的未達を確認 | `semantic_status=semantic-unsatisfied`, `lambda_status=unsatisfied` | transport failureへの書換え |
| 情報不足 | 対象軸=`unknown` | pass／failureへの推測 |
| cycle | `resolution_status=bottom`, `control_status=bottom` | Last Orderへの無条件昇格 |
| resource limit | `control_status=last-order` | resultへの縮退 |

Last Orderは現在routeで継続できない理由、要求する次判断、再開条件をenvelopeとして返す。例外messageだけへ縮退させない。
