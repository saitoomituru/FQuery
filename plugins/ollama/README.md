# @fquery/plugin-ollama

ローカルOllamaをFQuery Plugin ABIへ接続するnetwork adapterです。`/api/tags`からモデルを発見し、`/api/generate`のJSON Schema拘束出力をcandidate FAMとして再検証します。

Ollama process、model取得、端末資源管理はこのpluginの責務ではありません。既定endpointは`http://127.0.0.1:11434`で、Hostから差し替えられます。
