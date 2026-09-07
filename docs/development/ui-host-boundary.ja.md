# UI / Host boundary

React componentはruntimeを所有しない。mock fixtureだけで描画でき、Host bridgeはtyped eventをQ runtimeへ渡す。

自動testはrendering、状態class、event、keyboard操作、snapshotを検査する。実際の視認性、操作感、screen reader、実VS Code Webview、実Sphere hostはhuman testへ残す。
