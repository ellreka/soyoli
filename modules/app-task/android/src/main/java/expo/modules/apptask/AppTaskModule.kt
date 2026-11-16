package expo.modules.apptask

import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * アプリを、閉じずに裏へ回す。
 *
 * 最初の画面での「戻る」は、Android では画面（Activity）を閉じる。閉じると
 * expo-speech が読み上げエンジンとの接続を切り、読み上げが止まる。JS が
 * `moveToBack` を呼んで、ホームボタンと同じように裏へ回す。
 */
class AppTaskModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AppTask")

    /** アプリを裏へ回す。ホームボタンと同じで、画面は閉じない。 */
    AsyncFunction("moveToBack") {
      appContext.currentActivity?.moveTaskToBack(true) ?: false
    }.runOnQueue(Queues.MAIN)
  }
}
