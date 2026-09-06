# FQuery Plugin profile

```proton-manifest
{
  "proton_version": "proton.md/0.1.0-draft",
  "document_id": "proton://fquery/plugin-profile",
  "document_version": "0.1.0-draft",
  "document_kind": "profile",
  "language": "ja-JP",
  "lineage": {
    "source_refs": ["proton://fquery/core"],
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

pluginはcapabilityを宣言し、CoreのFAM semanticsを置換せず、bind／invoke／result envelopeを返す。

```fam-json id=fquery-plugin-manifest executable=false
{
  "schema_version": "fquery.plugin/0.1.0-draft",
  "plugin_id": "plugin://example/echo",
  "plugin_version": "0.1.0",
  "capabilities": ["echo"],
  "accepts": ["application/json"],
  "returns": ["application/json"],
  "authority": {
    "required": false,
    "scopes": []
  },
  "side_effect": "none",
  "unknown_policy": "retain",
  "last_order_policy": "return-envelope",
  "implementation": {
    "language": "typescript",
    "runtime": "node"
  }
}
```

plugin実装が存在してもport接続は成立しない。capabilityが見つからない場合は`plugin-not-found`を返し、route policyが要求する場合だけLast Orderへ接続する。
