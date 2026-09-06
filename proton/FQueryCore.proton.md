# FQuery Core profile

```proton-manifest
{
  "proton_version": "proton.md/0.1.0-draft",
  "document_id": "proton://fquery/core",
  "document_version": "0.1.0-draft",
  "document_kind": "profile",
  "language": "ja-JP",
  "lineage": {
    "source_refs": [
      "proton://sphere/fam-family",
      "https://github.com/saitoomituru/SphereOS-Atlantis/blob/4de928dec5196d458ace96432b2f9aac9c7cfabc/docs/architecture/proton-md-executable-context-container.ja.md"
    ],
    "supersedes": null,
    "source_mutation": false
  },
  "execution": {
    "default_mode": "interpret-only",
    "side_effect": "deny",
    "authority_required": true,
    "oae_transaction_required": true
  },
  "claim_scopes": ["DESIGN-DECISION", "UNVERIFIED"]
}
```

FQuery CoreはFAMを問い合わせ、binding、projection、検証する再帰operator `Q(...)`の意味境界を定める。Node.js、C++、WASM、remote runtimeのどれもこの文書だけから実行権限を得ない。

## Core record

```fam-json id=fquery-core-record executable=false
{
  "schema_version": "fquery/0.1.0-draft",
  "query_id": "q://example/root",
  "operator": "Q",
  "input": {
    "kind": "literal",
    "value": {}
  },
  "operations": [],
  "goal": {
    "lambda_ref": "lambda://example",
    "verifier_ref": null
  },
  "policy": {
    "side_effect": "deny",
    "unknown": "retain",
    "unresolved": "retain",
    "limits": {
      "max_depth": 32,
      "max_nodes": 10000,
      "timeout_ms": 30000
    }
  }
}
```

## 直交状態軸

| Axis | Values |
|---|---|
| `resolution_status` | `unresolved`, `resolved`, `bottom`, `unknown` |
| `connection_status` | `unconnected`, `connected`, `not-applicable` |
| `transport_status` | `not-started`, `running`, `succeeded`, `failed`, `unknown` |
| `plugin_status` | `not-requested`, `resolved`, `plugin-not-found`, `rejected`, `unknown` |
| `semantic_status` | `not-evaluated`, `satisfied`, `semantic-unsatisfied`, `unknown` |
| `lambda_status` | `not-evaluated`, `satisfied`, `unsatisfied`, `unknown` |
| `control_status` | `continue`, `result`, `bottom`, `last-order`, `cancelled` |

一つの軸の成功から別軸の成功を導出しない。特に`transport_status: succeeded`または`plugin_status: resolved`は`lambda_status: satisfied`を意味しない。

## 再帰停止

- cycle検出: `resolution_status: bottom`、`control_status: bottom`、reason=`cycle-detected`
- depth／node／timeout／cost上限: `control_status: last-order`
- verifierなし: `lambda_status: unknown`
- route差分があっても明示verifierが目的達成を確認: `semantic_status: satisfied`と`variation_status: valid-variation`

初期limitは参照fixtureの既定値であり、全Worldの普遍定数ではない。
