# 概要

ブラウザでTwitchのチャットを匿名で表示するもの

![sample](https://github.com/iuemon83/TwitchAnonymousChat/assets/12682383/455d88f5-b991-4bdb-a482-3a2f878ba043)

# 設定ファイル

```sh
cp settings.example.json settings.json
```

```json
{
  "twitch": {
    "clientId": "TwichアプリケーションのクライアントID",
    "redirectUrl": "OAuthのリダイレクトURL"
  }
}
```

# 依存ライブラリ

[tmi.js](https://github.com/tmijs/tmi.js)

