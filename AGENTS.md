これは Expo/React Native のモバイルアプリです。モバイルファーストのパターン、パフォーマンス、クロスプラットフォームの互換性を優先してください。

## Expo は変わっている — 学習データを信用しないこと

Expo は SDK のリリースごとに破壊的変更を入れます。覚えている API は、名前が変わったか、移動したか、削除されている可能性が高いです。Expo・EAS・React Native の API に触れるコードを書く前に:

1. `package.json` で `expo` パッケージのメジャーバージョンを確認する。
2. 対応するバージョンのドキュメントを取得する: `https://docs.expo.dev/versions/v<major>.0.0/`
3. それ以外は <https://docs.expo.dev/llms.txt> を取得する — Expo の全ドキュメントの索引で、LLM がよく間違える点の訂正も載っている。そこから必要なページへのリンクをたどること。記憶だけで答えてはならない。

## コマンド

プロジェクトが bun を使っている（`bun.lock` がある）場合は、`npx` の代わりに `bunx` を使う。

```bash
npx expo install <package>  # npm/yarn/pnpm/bun add の代わりに必ずこれを使う — SDK と互換のあるバージョンを解決する
npx expo start              # 開発サーバーを起動する
pnpm lint                   # oxlint で lint（設定: oxlint.config.mts。`expo lint` は ESLint 専用なので使わない）
pnpm format                 # oxfmt で整形（設定: .oxfmtrc.json）。`pnpm format:check` は確認だけ
pnpm typecheck              # 型チェック（tsc --noEmit）
pnpm test                   # ユニットテスト（jest-expo）
pnpm licenses:update        # 依存を足した・上げた後に、ライセンスの一覧（assets/licenses.json）を作り直す
pnpm licenses:native        # ネイティブの依存が変わった後に、その一覧（scripts/native-licenses.json）を作り直す。先に prebuild が要る
npx expo-doctor             # 依存関係と設定の問題を診断する
npx expo install --fix      # 互換性のないパッケージのバージョンを直す
```

タスクを完了とする前に、format・lint・typecheck・test を実行すること。

## アーキテクチャ

アプリが何をするかは `docs/spec.md` にある。どこに何があるか:

```
src/
  app/            ルートだけ: 各ファイルは features/ の画面を re-export する
  components/     アプリのことを知らない UI 部品（プラットフォーム別: .ios/.android）
  lib/jsonFile.ts JSON ファイルを起動をまたいで保存する唯一の方法
  testing/app.tsx 端末を偽物にしたアプリ全体。src/__tests__/app 用
  features/
    books/        Book の形式、その段落、ファイル（EPUB、PDF）が Book になるまで
    web/          sites/ = サイトごとに 1 つの WebSite（アドレス、パーサー）。episode.ts がページから Book を作る
    dictionary/   読み方辞書: そのデータ（entries.ts）、プロバイダー、編集画面
    speech/       段落について読み上げられるもの: ルール、ルビ、カッコの声（純粋関数）
    library/      読者が持っている作品: 本棚、履歴、その保存、本棚の画面
    player/       Playback（何が開いていて、どこにいて、どう読むか）、そのフック、プレーヤーの UI
    loading/      再生が来た章の本文の取得。最後の本の復元
    reader/       ビューアー: 章の本文、そのシート、表示設定
    browser/      アプリ内ブラウザと、話の検出
    backup/       バックアップ: ファイルの形（backup.ts）、ファイルの保存と選択、設定の行
    about/        このアプリについて: バージョン、使っているライブラリのライセンスの一覧と本文
    home/ settings/   残り 2 つのタブ
```

読みやすさを保つための決まり。コードを足すときは従うこと:

- **ファイルは 3 種類、向きは 1 つ。** モデル（素の `.ts`、React なし）← 状態（プロバイダーかフック）← 画面。モデルのファイルは、プロバイダーやコンポーネントを import しない。`import/no-cycle` は lint エラーになる。
- **モデルの feature は、この順に積み上がる:** `books` ← `web`、`dictionary` ← `speech`。`library`・`player`・`loading` はその上の状態で、画面はどれを使ってもよい。
- **段落が単位。** 読み上げられ、ハイライトされ、位置として保存されるのは `Paragraph`（`books/paragraphs.ts`）で、「文」ではない。`playback.json` はそのインデックスを今も `sentenceIndex` と呼んでいて、`player/storage.ts` が読み替える。ディスク上のキーの名前は変えないこと。
- **保存したファイルの形は永遠。** ディスクから読み戻すものはすべて、読む場所で検証する（`toDictionary`、`fromSavedWorks`、`initialSettings`、`savedPositions`）。古いファイルも動き続けなければならない。
- **開いている本は 2 か所で持たれる。** ライブラリ（画面が見せるもの）とプレーヤー（読み上げるもの）。作品を開くには `addBook`、続いて `playback.openBook`。開いている本を変える（章の本文が届いた、目次の続きが届いた）には `useOpenBook().replace` を使い、それ以外は使わない。
- **`playback.state` は何をどこで読むか、`playback.settings` はどう読むか。** 速度・高さ・声・カッコの声を変えると、読み上げ中の段落をやり直す。`keepAwake`・`pageSound`・`autoNext`・`authorNotes` はやり直してはならない。
- **バックアップのファイルも、保存したファイルと同じく形は永遠。** 入るのは辞書・音声設定・Web 小説のメタ情報と読みかけの位置だけ（`backup/backup.ts`）。読み戻すときは、端末のファイルと同じ検証を通す。
- **依存を変えたら、ライセンスの一覧を作り直す。** `assets/licenses.json` は `scripts/licenses.mjs` が書く生成物で、手で編集しない。載るのはアプリに入るものだけで、スクリプトは iOS と Android のバンドルを書き出して調べる（1 分ほどかかる）。ネイティブ側だけが入れるライブラリは `scripts/native-licenses.json` に持つ（これも生成物）: Expo や React Native を上げた、ネイティブのライブラリを足したときは、`npx expo prebuild` のあと `pnpm licenses:native`、続けて `pnpm licenses:update` を実行する。ライブラリではない素材（音など）は `scripts/licenses.mjs` の `extras` に足す。作り直し忘れはテストが落ちて知らせる。
- **依存のバージョンは固定する。** `package.json` には範囲（`^`・`~`）ではなく、入れるバージョンそのものを書く（`pnpm-workspace.yaml` の `saveExact`）。`npx expo install` が `~` 付きで書いたら、その記号を外す。CI は `pnpm install --frozen-lockfile` で、lockfile のとおりにだけ入れる。GitHub Actions の action も同じで、ワークフローには完全なタグ（`@v7.0.1`）を書き、コミットは `.github/workflows/actions.lock` が固定する。これは生成物で、手で編集しない: `uses:` を足した・変えた後は `gh actions-lock` を実行する（`gh extension install github/gh-actions-lock`）。
- **新しいサイト** は、`web/sites/` に `WebSite` を実装したファイルを 1 つ、`sites/index.ts` に項目を 1 つ、`books/book.ts` にその id と名前を足す。**新しいファイル形式** は、`books/import.ts` の `formats` に項目を 1 つ足す。
- **Web 小説: 保存するのはメタ情報だけ。** 本文も目次も決して保存しない。保存する範囲を広げる前に確認すること。
- **テスト:** 対象ごとのユニットテストは `src/__tests__/` に、画面を通すテストは `src/__tests__/app/` に置く（最初に `@/testing/app` を import する: これが偽物を用意する）。
- **コメントは日本語で書く。** コードのコメント、JSDoc、設定ファイルのコメント、このファイルのようなドキュメントは、基本的に日本語にする。識別子、API 名、`oxlint-disable` や `SAFETY:` のような決まった目印はそのまま書く。

## ナビゲーションとルーティング

- ナビゲーションにはすべて **Expo Router** を使う。ルートは `src/app/` にある — そこにあるファイルはどれも画面で、`_layout.tsx` がナビゲーターを定義する。ルートでないコード（コンポーネント、フック、ユーティリティ）は `src/app/` の外に置く。
- `Link`、`router`、`useLocalSearchParams` は `expo-router` から import する。
- ドキュメント: <https://docs.expo.dev/router/introduction.md>

## EAS でのビルド

アプリのビルド・署名・提出はクラウドの EAS で行い（`eas build`、`eas submit`）、OTA アップデートの配信も EAS で行う（`eas update`） — ローカルの Xcode や Android Studio は要らない。EAS CLI は、Bun のプロジェクトでは `bunx eas-cli <command>`、それ以外では `npx eas-cli@latest <command>` として実行する。ドキュメントの例にある素の `eas` は、これに読み替えること。
ドキュメント: <https://docs.expo.dev/eas/index.md>

Android は GitHub Actions でもビルドできる（`.github/workflows/build-android.yml`）: runner の上で `eas build --local` を実行し、署名の鍵は EAS から取る。手動で実行する（プロファイルを選ぶ）か、`v*` のタグを push すると `production-apk` の APK が Release に付く（タグは `app.json` の `version` と同じでなければならない: `0.0.1` なら `v0.0.1`）。リポジトリの Secret に `EXPO_TOKEN` が要る。EAS CLI の版はワークフローの `EAS_CLI_VERSION` で固定している。

## ルール

- `ios/` と `android/` のディレクトリがない場合、それらは生成される（Continuous Native Generation）。手で作ったり編集したりしてはならない — ネイティブの挙動は `app.json` と config plugin で設定する。
- Expo Go には、同梱されているネイティブモジュールしか入っていない。ネイティブコードを含むライブラリを足したら、アプリには development build が必要になる: ローカルなら `npx expo run:ios|android`、または `eas build --profile development`。
- サードパーティのライブラリより、推奨されている Expo のモジュールを優先する。依存を足す前に、使えるスキルも確認すること。ドキュメント: <https://docs.expo.dev/versions/latest/index.md>
