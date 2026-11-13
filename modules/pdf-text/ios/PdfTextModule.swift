import ExpoModulesCore
import PDFKit
import UIKit

internal final class PdfUnreadableException: Exception {
  override var reason: String {
    "The PDF could not be read"
  }
}

internal final class PdfLockedException: Exception {
  override var reason: String {
    "The PDF is protected by a password"
  }
}

/// `file://` URI の PDF を開く。文書は丸ごと読み込まず、ページが
/// 求められるたびにファイルから読む。
private func openDocument(_ uri: String) throws -> PDFDocument {
  guard let url = URL(string: uri), url.isFileURL, let document = PDFDocument(url: url) else {
    throw PdfUnreadableException()
  }
  if document.isLocked {
    throw PdfLockedException()
  }
  return document
}

public class PdfTextModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PdfText")

    // ページ数と、ファイルにあればタイトルと著者。
    AsyncFunction("info") { (uri: String) -> [String: Any] in
      let document = try openDocument(uri)
      let attributes = document.documentAttributes
      return [
        "pages": document.pageCount,
        "title": attributes?[PDFDocumentAttribute.titleAttribute] as? String ?? "",
        "author": attributes?[PDFDocumentAttribute.authorAttribute] as? String ?? ""
      ]
    }

    // 最初のページを幅 `width` ピクセルの JPEG（base64）にしたもの: 表紙。
    // ページを描けないときは ""。
    AsyncFunction("cover") { (uri: String, width: Int) -> String in
      let document = try openDocument(uri)
      guard let page = document.page(at: 0) else {
        return ""
      }
      let bounds = page.bounds(for: .cropBox)
      guard bounds.width > 0, bounds.height > 0, width > 0 else {
        return ""
      }
      let size = CGSize(width: CGFloat(width), height: CGFloat(width) * bounds.height / bounds.width)
      let image = page.thumbnail(of: size, for: .cropBox)
      return image.jpegData(compressionQuality: 0.8)?.base64EncodedString() ?? ""
    }

    // 指定したページ（0 始まり）の文字を、1 ページにつき 1 つの文字列で返す。
    // 文字のないページ、ファイルにないページは ""。
    AsyncFunction("texts") { (uri: String, pages: [Int]) -> [String] in
      let document = try openDocument(uri)
      return pages.map { index in
        guard index >= 0, index < document.pageCount else {
          return ""
        }
        return document.page(at: index)?.string ?? ""
      }
    }
  }
}
