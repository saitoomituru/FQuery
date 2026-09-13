# @fam/ibd

IBD `experiments/season0/fquery_cli.py`(`FamDocumentStore`)へCLI harness経由でput/resolveを橋渡しするpluginです。`@fquery/plugin-sdk`の`createCliHarnessHandler`を使い、Node `child_process`でPython CLIをspawnします。shellは経由しません。

## 提供capability

- `ibd.put({ document })`: FAM documentをIBD storageへ保存する
- `ibd.resolve({ famRef, revisionPolicy })`: `{mode: "pinned", revisionRef}`または`{mode: "latest"}`でrevisionを解決する。未取得は例外ではなく`result.status === "unknown"`として返る

## 非対応(明示)

- evidence/oae/module-graphは未接続(IBD側`storage_adapter.FamDocumentStore`にはあるが、このpluginはput/resolveのみ橋渡しする)
- 本番backend adapter(Neo4j/SQLite/PostgreSQL等)への接続。IBD `experiments/season0`はfile-backed reference実装であり、本番backend選定はIBD #3/#4のUser Gate対象のまま

## 使い方

```ts
import { createIbdPlugin } from "@fam/ibd";
import { PluginRegistry } from "@fquery/plugin-sdk";

const { manifest, handler } = createIbdPlugin({
  ibdRoot: "/path/to/IBD",
  storageRoot: "/path/to/storage-data",
});
const registry = new PluginRegistry();
registry.register(manifest, handler);
```

`ibdRoot`はIBDリポジトリのcheckout先、`storageRoot`は`FamDocumentStore`が実際にfileを書き込む先(IBDリポジトリの外の任意ディレクトリでよい)です。
