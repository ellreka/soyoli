<p align="center">
  <img src="assets/images/icon.png" width="120" alt="Soyoli のアイコン">
</p>

# Soyoli

Web 小説や EPUB などを読み上げながら読むためのアプリ

## 主な機能

- EPUB・PDF のファイルを取り込んで読む
- Web 小説を、アプリ内ブラウザで開いたページからそのまま読む
- 端末の音声で本文を読み上げる
- 読み方辞書で読み方の変更(正規表現に対応)
- 会話文など括弧の種類ごとに別の音声を設定
- スリープタイマー

仕様は [docs/spec.md](docs/spec.md)、コードの構成と決まりは [AGENTS.md](AGENTS.md) にある。

## 開発

```bash
pnpm install
npx expo start
```

端末の読み上げ・ロック画面の操作・PDF の読み出しにネイティブのモジュールを使うため、Expo Go では動かない。development build（上のコマンド、または `eas build --profile development`）で動かす。

```bash
pnpm format      # 整形（oxfmt）
pnpm lint        # lint（oxlint）
pnpm typecheck   # 型チェック
pnpm test        # テスト（jest-expo）
```

## ライセンス

© 2026 ellreka. All rights reserved.

このリポジトリにオープンソースライセンスは付けていない。ソースコード、アプリ名「Soyoli」、アイコンの複製・改変・再配布は許可しない。
