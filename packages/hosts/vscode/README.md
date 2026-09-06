# @fquery/host-vscode

VS Code WebviewとFQuery runtime間のHost bridge。UI componentへruntimeを埋め込まない。

`createVsCodeHostBridge`はWebviewの`postMessage`相当だけを要求し、VS Code APIそのものへUI packageを依存させない。
実VS Code extensionへの組み込みと人間による画面確認は未実施。
