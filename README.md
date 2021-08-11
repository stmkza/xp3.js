# XP3.js
吉里吉里のXP3アーカイブをWebブラウザのJavaScriptから読めるようにするスクリプト

## 試してみる
PHPをインストールし、このリポジトリのルートで `php -S 0.0.0.0:80` を実行、そしてWebブラウザで以下のURLを開いてください。

### デモ1: ファイルリスト表示
XP3アーカイブに含まれるファイルをリスト表示し、テキストファイルと画像ファイルをプレビューします。

[http://localhost/test/index.html](http://localhost/test/index.html)

### デモ2: ServiceWorkerを使用したVFS的なもの
アーカイブに含まれるファイルを普通にサーバ上にあるファイルと同じように扱えるようにします。
`/test/.vfs/xp3/{ARCHIVE_NAME}>{PATH}` のようにアクセスしてください。

[http://localhost/test/serviceworker.html](http://localhost/test/serviceworker.html)

## 注意事項
これは実験的に作っているものです。コードは最低限動けばいい程度のもので、（キャッシュ系の実装をまともにやっていないことを含めて）かなり雑です。
実際にこれを使って何かを作ることは推奨しません。

また、これはサーバ側が`Range`指定リクエストに対応している必要があります。
Range指定リクエストを大量に飛ばすのでS3等のリクエスト数課金があるサーバでは使わない方がいいと思います。
