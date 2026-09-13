# @fam/ibd

IBD `experiments/season0/fquery_cli.py`(`FamDocumentStore`)へCLI harness経由でput/resolve/put_oae/resolve_with_oaeを橋渡しするpluginです。`@fquery/plugin-sdk`の`createCliHarnessHandler`を使い、Node `child_process`でPython CLIをspawnします。shellは経由しません。

## 提供capability

- `ibd.put({ document })`: FAM documentをIBD storageへ保存する
- `ibd.resolve({ famRef, revisionPolicy })`: `{mode: "pinned", revisionRef}`または`{mode: "latest"}`でrevisionを解決する。未取得は例外ではなく`result.status === "unknown"`として返る
- `ibd.put_oae({ subjectRef, oaeRef, envelope })`: OAEをIBD storageへ保存する。**OAE発行自体はこのplugin(FQuery側)の責務**であり、IBD側は証跡記録のみを行う(IBD `docs/architecture/pool-occurrence-driver.ja.md`§7.2)。このcapabilityはその発行済みOAEをIBD storageへ橋渡しするだけで、observer verdictの真偽やdomain rule内容は裁定しない
- `ibd.resolve_with_oae({ famRef, revisionPolicy })`: FAM projection(backend固有schemaを含まない、元のFQuery FAMそのもの)と、そのsubjectに紐づく全OAE recordsを合わせて返す。#44 Phase D round-trip(`FQuery canonical FAM -> IBD driver write -> read/query -> OAE candidate evaluation -> verdict/receipt persistence -> FQuery reload/projection`)の最後の段。未解決は`result.status === "unknown"`として返り、silent successへ丸めない

## 非対応(明示)

- evidence/module-graphは未接続(IBD側`storage_adapter.FamDocumentStore`にはあるが、このpluginはput/resolve/put_oae/resolve_with_oaeのみ橋渡しする)
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
