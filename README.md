# Soyoli

日本語の小説を「読む」と「聴く（端末の音声合成による読み上げ）」の両方で楽しむモバイルアプリ（Expo / React Native）。

- 取り込んだファイル（EPUB・PDF）と、Web 小説（小説家になろう・カクヨム・ハーメルン）を同じビューアーで読む
- 読み方辞書とカッコ別の音声で、読み上げを聞きやすくする

仕様は [docs/spec.md](docs/spec.md)、コードの構成と決まりは [AGENTS.md](AGENTS.md) にある。

## 開発

```bash
pnpm install
npx expo run:ios      # または npx expo run:android
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

次のものは、それぞれの権利者のライセンスに従う:

- ページをめくる音（`assets/sounds/page-turn.mp3`）: [OtoLogic](https://otologic.jp) の素材（[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.ja)）
- 使っているライブラリ: アプリの「設定」→「オープンソースライセンス」に一覧と本文がある（`assets/licenses.json`）
