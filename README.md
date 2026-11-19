<div align="center">

<img src="assets/images/icon.png" width="120" alt="Soyoli のアイコン">

# Soyoli

Web 小説や EPUB などを読み上げながら読むためのアプリ

[![最新のリリース](https://img.shields.io/github/v/release/ellreka/soyoli?label=release)](https://github.com/ellreka/soyoli/releases/latest)
[![ダウンロード数](https://img.shields.io/github/downloads/ellreka/soyoli/total)](https://github.com/ellreka/soyoli/releases)
[![Android のビルド](https://github.com/ellreka/soyoli/actions/workflows/build-android.yml/badge.svg)](https://github.com/ellreka/soyoli/actions/workflows/build-android.yml)

<a href="https://apps.obtainium.imranr.dev/redirect.html?r=obtainium://add/https://github.com/ellreka/soyoli"><img src="https://raw.githubusercontent.com/ImranR98/Obtainium/main/assets/graphics/badge_obtainium.png" height="64" alt="Obtainium で入手"></a>

</div>

## 主な機能

- EPUB・PDF のファイルを取り込んで読む
- Web 小説を、アプリ内ブラウザで開いたページからそのまま読む
- 端末の音声で本文を読み上げる
- 読み方辞書で読み方の変更(正規表現に対応)
- 会話文など括弧の種類ごとに別の音声を設定
- スリープタイマー

## インストール

配っているのは Android の APK だけ。次のどちらかで入れる。

- **GitHub から:** [Releases](https://github.com/ellreka/soyoli/releases/latest) の APK（arm64）を落として開く。
- **Obtainium から:** [Obtainium](https://obtainium.imranr.dev/) にこのリポジトリを登録する。新しい版が出たときに更新できる。上のバッジを Android で押すと、登録の画面が開く。

## 開発

仕様は [docs/spec.md](docs/spec.md)、コードの構成と決まりは [AGENTS.md](AGENTS.md) にある。

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
