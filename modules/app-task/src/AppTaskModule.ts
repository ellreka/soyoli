import { requireOptionalNativeModule, type NativeModule } from "expo";

declare class AppTaskModule extends NativeModule {
  /** アプリを裏へ回す。ホームボタンと同じで、画面は閉じない。 */
  moveToBack(): Promise<boolean>;
}

/**
 * ネイティブ側がないところでは null: iOS と Web、それに、このモジュールが
 * 入る前に作ったビルド（そこへ配信したアップデートも動かなければならない）。
 */
export default requireOptionalNativeModule<AppTaskModule>("AppTask");
