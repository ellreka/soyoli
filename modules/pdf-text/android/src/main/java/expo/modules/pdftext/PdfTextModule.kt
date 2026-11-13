package expo.modules.pdftext

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.util.Base64
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.encryption.InvalidPasswordException
import com.tom_roush.pdfbox.text.PDFTextStripper
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.io.File

internal class PdfUnreadableException(cause: Throwable?) :
  CodedException("The PDF could not be read", cause)

internal class PdfLockedException(cause: Throwable?) :
  CodedException("The PDF is protected by a password", cause)

class PdfTextModule : Module() {
  /**
   * `file://` URI の PDF を `use` の間だけ開く。文書は丸ごと読み込まず、
   * ページが求められるたびにファイルから読む。
   */
  private fun <T> withDocument(uri: String, use: (PDDocument) -> T): T {
    val context = appContext.reactContext ?: throw PdfUnreadableException(null)
    val path = Uri.parse(uri).path ?: throw PdfUnreadableException(null)
    try {
      // 2 回目以降は何もしない。
      PDFBoxResourceLoader.init(context.applicationContext)
      return PDDocument.load(File(path)).use(use)
    } catch (error: InvalidPasswordException) {
      throw PdfLockedException(error)
    } catch (error: CodedException) {
      throw error
    } catch (error: Exception) {
      throw PdfUnreadableException(error)
    } catch (error: OutOfMemoryError) {
      throw PdfUnreadableException(error)
    }
  }

  override fun definition() = ModuleDefinition {
    Name("PdfText")

    // ページ数と、ファイルにあればタイトルと著者。
    AsyncFunction("info") { uri: String ->
      withDocument(uri) { document ->
        val information = document.documentInformation
        mapOf(
          "pages" to document.numberOfPages,
          "title" to (information?.title ?: ""),
          "author" to (information?.author ?: "")
        )
      }
    }

    // 最初のページを幅 `width` ピクセルの JPEG（base64）にしたもの: 表紙。
    // ページを描けないときは ""。描くのはプラットフォーム自身のレンダラーで、
    // PDFBox は文字にしか使わない。
    AsyncFunction("cover") { uri: String, width: Int ->
      val path = Uri.parse(uri).path ?: throw PdfUnreadableException(null)
      try {
        ParcelFileDescriptor.open(File(path), ParcelFileDescriptor.MODE_READ_ONLY).use { descriptor ->
          PdfRenderer(descriptor).use { renderer ->
            if (renderer.pageCount < 1 || width < 1) {
              return@AsyncFunction ""
            }
            renderer.openPage(0).use { page ->
              val height = maxOf(1, width * page.height / maxOf(1, page.width))
              val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
              // ページ自体には背景がない。
              bitmap.eraseColor(Color.WHITE)
              page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
              val bytes = ByteArrayOutputStream()
              bitmap.compress(Bitmap.CompressFormat.JPEG, 80, bytes)
              bitmap.recycle()
              Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP)
            }
          }
        }
      } catch (error: Exception) {
        // 表紙がなくても作品は作品。
        ""
      } catch (error: OutOfMemoryError) {
        ""
      }
    }

    // 指定したページ（0 始まり）の文字を、1 ページにつき 1 つの文字列で返す。
    // 文字のないページ、ファイルにないページは ""。
    AsyncFunction("texts") { uri: String, pages: List<Int> ->
      withDocument(uri) { document ->
        val stripper = PDFTextStripper()
        pages.map { index ->
          if (index < 0 || index >= document.numberOfPages) {
            ""
          } else {
            stripper.startPage = index + 1
            stripper.endPage = index + 1
            stripper.getText(document)
          }
        }
      }
    }
  }
}
