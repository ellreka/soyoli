import { requireOptionalNativeModule, type NativeModule } from "expo";

export interface PdfInfo {
  pages: number;
  /** ファイルに書かれていなければ ""。 */
  title: string;
  author: string;
}

declare class PdfTextModule extends NativeModule {
  /** ページ数と、ファイルにあればタイトルと著者。 */
  info(uri: string): Promise<PdfInfo>;
  /**
   * 指定したページ（0 始まり）の文字を、1 ページにつき 1 つの文字列で返す。
   * 文字のないページは ""。
   */
  texts(uri: string, pages: number[]): Promise<string[]>;
  /**
   * 最初のページを幅 `width` ピクセルの JPEG（base64）にしたもの。描けない
   * ときは ""。表紙を描くようになる前に作ったビルドにはない。
   */
  cover?(uri: string, width: number): Promise<string>;
}

/**
 * ネイティブ側がないところでは null: Web と、PDF を読めるようになる前に
 * 作ったビルド（そこへ配信したアップデートも動かなければならない）。
 */
export default requireOptionalNativeModule<PdfTextModule>("PdfText");
