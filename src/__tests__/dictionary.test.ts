import {
  addEntry,
  assignSet,
  booksUsing,
  createSet,
  deleteSet,
  emptyDictionary,
  patternError,
  removeEntry,
  renameSet,
  setEntryEnabled,
  setOf,
  setSystemRule,
  toDictionary,
} from "@/features/dictionary/entries";
import { activeSystemRules, systemRules } from "@/features/dictionary/system";
import { bracketKinds } from "@/features/speech/brackets";
import {
  chapterReplacements,
  expandReading,
  speechFor,
} from "@/features/speech/replacements";
import { paragraphSegments, speechSegments } from "@/features/speech/segments";
import { parseChapter, type Paragraph } from "@/features/books/paragraphs";

/** ルビのない段落を、組み込みのルールだけでどう読むか。 */
function system(text: string): string {
  return speechFor({ text, speech: text }, [], [], systemRules);
}

const plain: Paragraph = {
  text: "　小鳥遊さんと小鳥が遊ぶ。",
  speech: "小鳥遊さんと小鳥が遊ぶ。",
};
// 「漢字」にルビ かんじ が付いている。
const withRuby: Paragraph = {
  text: "次は漢字です。",
  speech: "次はかんじです。",
  ruby: [{ start: 2, length: 2, reading: "かんじ" }],
};

it("leaves the speech alone without rules", () => {
  expect(speechFor(withRuby, [], [])).toBe("次はかんじです。");
});

it("reads registered text as registered, longest match first, without touching the text", () => {
  const rules = [
    { surface: "小鳥", reading: "ことり" },
    { surface: "小鳥遊", reading: "たかなし" },
  ];
  expect(speechFor(plain, [], rules)).toBe("たかなしさんとことりが遊ぶ。");
  expect(speechFor(plain, rules, [])).toBe("たかなしさんとことりが遊ぶ。");
  expect(plain.text).toBe("　小鳥遊さんと小鳥が遊ぶ。");
});

it("applies the work's rules over ruby, and ruby over the rules for every work", () => {
  const rule = [{ surface: "漢字", reading: "カンジ" }];
  // 全作品共通のルールは、本文そのものに書かれた読みを上書きしない。
  expect(speechFor(withRuby, [], rule)).toBe("次はかんじです。");
  // 作品自身のルールは上書きする。
  expect(speechFor(withRuby, rule, [])).toBe("次はカンジです。");
  // 両方が一致するところでは作品のルールが勝ち、残りには共通のルールが効く。
  expect(
    speechFor(
      plain,
      [{ surface: "小鳥遊", reading: "たかなし" }],
      [
        { surface: "小鳥遊さん", reading: "だれか" },
        { surface: "遊ぶ", reading: "あそぶ" },
      ],
    ),
  ).toBe("たかなしさんと小鳥があそぶ。");
});

it("reads what a regular expression finds, filling in its groups", () => {
  const url: Paragraph = {
    text: "詳細は https://example.com/a?b=1 を見てね。第12話と第3話。",
    speech: "",
  };
  expect(
    speechFor(
      url,
      [],
      [
        { surface: "https?://\\S+", reading: "URL省略", regex: true },
        { surface: "第(\\d+)話", reading: "だい$1わ", regex: true },
      ],
    ),
  ).toBe("詳細は URL省略 を見てね。だい12わとだい3わ。");
  expect(url.text).toContain("https://example.com/a?b=1");
});

it("lets the longest match win between plain and regex rules, and the work's rules over ruby", () => {
  expect(
    speechFor(
      plain,
      [],
      [
        { surface: "小鳥", reading: "ことり" },
        { surface: "小鳥遊(さん)", reading: "たかなし$1", regex: true },
      ],
    ),
  ).toBe("たかなしさんとことりが遊ぶ。");
  // ルビは、全作品共通の正規表現ルールにも勝つ。作品のルールには勝たない。
  const rule = [{ surface: "漢.", reading: "カンジ", regex: true }];
  expect(speechFor(withRuby, [], rule)).toBe("次はかんじです。");
  expect(speechFor(withRuby, rule, [])).toBe("次はカンジです。");
});

it("ignores a regex rule that does not compile or matches nothing", () => {
  expect(patternError("(")).not.toBeNull();
  expect(patternError("第\\d+話")).toBeNull();
  expect(
    speechFor(
      plain,
      [],
      [
        { surface: "(", reading: "x", regex: true },
        { surface: "z*", reading: "ぜっと", regex: true },
        { surface: "遊ぶ", reading: "あそぶ" },
      ],
    ),
  ).toBe("小鳥遊さんと小鳥があそぶ。");
});

it("fills in $ references as String.prototype.replace does", () => {
  const match = /(?<word>a)(b)/u.exec("ab")!;
  expect(expandReading("$2$1-$<word>-$&-$$-$9-$<none>", match)).toBe(
    "ba-a-ab-$-$9-$<none>",
  );
  // グループ 12 がないときの "$12" は、グループ 1 に "2" が続いたもの。
  expect(expandReading("$12", match)).toBe("a2");
});

it("keeps the regex mark when reading the saved dictionary", () => {
  expect(
    toDictionary({
      common: [
        { surface: "a+", reading: "えー", regex: true },
        { surface: "b", reading: "びー", regex: "yes" },
      ],
    }).common,
  ).toEqual([
    { surface: "a+", reading: "えー", regex: true },
    { surface: "b", reading: "びー" },
  ]);
});

it("adds, replaces and removes rules in a dictionary", () => {
  const scope = { setId: "s1" };
  let dictionary = createSet(emptyDictionary, "s1", "作品");
  dictionary = addEntry(dictionary, scope, {
    surface: "小鳥遊",
    reading: "ことりあそび",
  });
  dictionary = addEntry(dictionary, scope, {
    surface: "小鳥遊",
    reading: "たかなし",
  });
  dictionary = addEntry(dictionary, "common", {
    surface: "一",
    reading: "いち",
  });
  expect(dictionary).toEqual({
    common: [{ surface: "一", reading: "いち" }],
    sets: [
      {
        id: "s1",
        name: "作品",
        entries: [{ surface: "小鳥遊", reading: "たかなし" }],
      },
    ],
    assigned: {},
  });
  dictionary = removeEntry(dictionary, scope, "小鳥遊");
  // 空にした辞書は残る: まだ使っている作品があるかもしれない。
  expect(dictionary.sets).toEqual([{ id: "s1", name: "作品", entries: [] }]);
  expect(removeEntry(dictionary, "common", "一").common).toEqual([]);
});

it("lets several works share one dictionary, each using at most one", () => {
  let dictionary = createSet(emptyDictionary, "s1", "Re:ゼロ");
  dictionary = createSet(dictionary, "s2", "別の辞書");
  dictionary = addEntry(
    dictionary,
    { setId: "s1" },
    {
      surface: "昴",
      reading: "すばる",
    },
  );
  // 2 つのサイトにある同じ物語は、同じ読みを使う。
  dictionary = assignSet(dictionary, "narou-n1", "s1");
  dictionary = assignSet(dictionary, "kakuyomu-1", "s1");
  expect(booksUsing(dictionary, "s1")).toEqual(["narou-n1", "kakuyomu-1"]);
  expect(setOf(dictionary, "kakuyomu-1")?.entries).toEqual([
    { surface: "昴", reading: "すばる" },
  ]);
  // 別の辞書を選ぶと選択が置き換わる。両方になることはない。
  dictionary = assignSet(dictionary, "kakuyomu-1", "s2");
  expect(booksUsing(dictionary, "s1")).toEqual(["narou-n1"]);
  expect(setOf(dictionary, "kakuyomu-1")?.id).toBe("s2");
  // 作品は辞書を使わないこともできる。知らない辞書は割り当てられない。
  expect(setOf(assignSet(dictionary, "narou-n1", null), "narou-n1")).toBe(
    undefined,
  );
  expect(assignSet(dictionary, "epub", "missing").assigned.epub).toBe(
    undefined,
  );
  // 名前を変えても、読みと作品はそのまま。
  expect(renameSet(dictionary, "s1", "リゼロ").sets[0]).toMatchObject({
    id: "s1",
    name: "リゼロ",
  });
  // 辞書を削除すると、使っていた作品は辞書なしになる。
  const deleted = deleteSet(dictionary, "s1");
  expect(deleted.sets.map((set) => set.id)).toEqual(["s2"]);
  expect(deleted.assigned).toEqual({ "kakuyomu-1": { setId: "s2" } });
});

it("drops anything malformed when reading the saved dictionary", () => {
  expect(toDictionary(null)).toEqual(emptyDictionary);
  expect(
    toDictionary({
      common: [
        { surface: "一", reading: "いち" },
        { surface: "一", reading: "ひと" },
        { surface: "", reading: "x" },
        { surface: "二" },
        "三",
      ],
      sets: [
        {
          id: "s1",
          name: "作品",
          entries: [{ surface: "四", reading: "よん" }],
        },
        { id: "s1", name: "重複", entries: [] },
        { name: "IDなし", entries: [] },
        "nope",
      ],
      assigned: { a: "s1", b: "missing", c: 3 },
    }),
  ).toEqual({
    common: [{ surface: "一", reading: "いち" }],
    sets: [
      { id: "s1", name: "作品", entries: [{ surface: "四", reading: "よん" }] },
    ],
    // id だけのもの（以前の形）は、タイトルのない選択として読む。
    assigned: { a: { setId: "s1" } },
  });
});

it("turns readings saved per work into a dictionary used by that work", () => {
  expect(
    toDictionary({
      common: [],
      books: {
        "narou-n1": [{ surface: "昴", reading: "すばる" }],
        empty: [],
      },
    }),
  ).toEqual({
    common: [],
    sets: [
      {
        id: "book:narou-n1",
        // タイトルが分かるまでは、作品の id が名前になる。
        name: "narou-n1",
        entries: [{ surface: "昴", reading: "すばる" }],
      },
    ],
    assigned: { "narou-n1": { setId: "book:narou-n1" } },
  });
});

it("keeps the work's title and page with its choice of dictionary", () => {
  let dictionary = createSet(emptyDictionary, "s1", "辞書");
  dictionary = assignSet(dictionary, "narou-n1234ab", "s1", {
    title: "作品名",
    url: "https://novel18.syosetu.com/n1234ab/",
  });
  expect(dictionary.assigned).toEqual({
    "narou-n1234ab": {
      setId: "s1",
      title: "作品名",
      url: "https://novel18.syosetu.com/n1234ab/",
    },
  });
  // 保存したとおりに読み戻す。Web ページでないものは落とす。
  expect(toDictionary(dictionary).assigned).toEqual(dictionary.assigned);
  expect(
    toDictionary({
      ...dictionary,
      assigned: { x: { setId: "s1", title: 3, url: "file:///etc/hosts" } },
    }).assigned,
  ).toEqual({ x: { setId: "s1" } });
});

it("shortens URLs with the built-in rules", () => {
  expect(system("詳細は https://example.com/a?b=1 を見てね。")).toBe(
    "詳細は URL省略 を見てね。",
  );
  expect(system("www.example.comへ")).toBe("URL省略へ");
});

it("leaves dividers unread and turns rules into a pause", () => {
  expect(system("◆◇◆")).toBe("");
  expect(system("＊　＊　＊")).toBe("");
  // 記号 2 つは区切り線ではない。
  expect(system("★☆")).toBe("★☆");
  expect(system("それは――違う")).toBe("それは、違う");
});

it("reads placeholders and laughter, but not numerals or English", () => {
  expect(system("〇〇さんと○○さん")).toBe("まるまるさんとまるまるさん");
  expect(system("二〇〇〇年")).toBe("二〇〇〇年");
  expect(system("〇〇年")).toBe("〇〇年");
  expect(system("それなｗｗｗ")).toBe("それなわら");
  expect(system("awww and www.")).toBe("awww and www.");
});

it("lets the user's rules win over the built-in ones", () => {
  const paragraph = { text: "◆◇◆", speech: "◆◇◆" };
  expect(
    speechFor(
      paragraph,
      [],
      [{ surface: "◆◇◆", reading: "場面転換" }],
      systemRules,
    ),
  ).toBe("場面転換");
});

it("reads the text, not the marks, under emphasis-dot ruby (傍点)", () => {
  const { paragraphs } = parseChapter([
    {
      type: "element",
      tag: "ruby",
      children: [
        { type: "text", text: "強" },
        {
          type: "element",
          tag: "rt",
          children: [{ type: "text", text: "・" }],
        },
      ],
    },
    { type: "text", text: "い" },
  ]);
  expect(paragraphs[0]).toMatchObject({ text: "強い", speech: "強い" });
  expect(speechFor(paragraphs[0], [], [], systemRules)).toBe("強い");
});

it("turns built-in rules off and on one by one, and keeps the choice", () => {
  const off = setSystemRule(
    setSystemRule(emptyDictionary, "divider", false),
    "url",
    false,
  );
  expect(off.systemOff).toEqual(["divider", "url"]);
  expect(setSystemRule(off, "url", false)).toEqual(off);
  expect(toDictionary(JSON.parse(JSON.stringify(off)))).toEqual(off);
  // オンのままのルールだけが適用される。
  const rules = activeSystemRules(off.systemOff);
  const paragraph = { text: "◆◇◆ https://example.com ｗｗ", speech: "" };
  expect(speechFor(paragraph, [], [], rules)).toBe(
    "◆◇◆ https://example.com わら",
  );
  expect(
    setSystemRule(setSystemRule(off, "url", true), "divider", true),
  ).toEqual(emptyDictionary);
  expect(toDictionary({ systemOff: true })).toEqual(emptyDictionary);
  expect(toDictionary({ systemOff: ["url", 3, "url", ""] }).systemOff).toEqual([
    "url",
  ]);
});

it("keeps a reading that is turned off, without applying it", () => {
  const rules = [
    { surface: "小鳥遊", reading: "たかなし", off: true as const },
    { surface: "小鳥", reading: "ことり" },
  ];
  expect(speechFor(plain, [], rules)).toBe("ことり遊さんとことりが遊ぶ。");
  expect(toDictionary({ common: rules }).common).toEqual(rules);
  expect(
    toDictionary({ common: [{ surface: "a", reading: "b", off: "yes" }] })
      .common,
  ).toEqual([{ surface: "a", reading: "b" }]);
});

it("turns a reading off and on where it is, in its dictionary", () => {
  const entries = [
    { surface: "一", reading: "いち" },
    { surface: "二", reading: "に", regex: true },
  ];
  const dictionary = { ...emptyDictionary, common: entries };
  const off = setEntryEnabled(dictionary, "common", "二", false);
  // 位置と、それ以外の内容は保たれる。
  expect(off.common).toEqual([entries[0], { ...entries[1], off: true }]);
  expect(setEntryEnabled(off, "common", "二", true)).toEqual(dictionary);
});

it("keeps a reading's description when reading the saved dictionary", () => {
  expect(
    toDictionary({
      common: [
        { surface: "a", reading: "えー", description: "英字のA" },
        { surface: "b", reading: "びー", description: "" },
        { surface: "c", reading: "しー", description: 3 },
      ],
    }).common,
  ).toEqual([
    { surface: "a", reading: "えー", description: "英字のA" },
    { surface: "b", reading: "びー" },
    { surface: "c", reading: "しー" },
  ]);
});

it("keeps an empty reading: the text is not read", () => {
  const { common } = toDictionary({
    common: [{ surface: "（笑）", reading: "" }],
  });
  expect(common).toEqual([{ surface: "（笑）", reading: "" }]);
  expect(
    speechFor({ text: "そうだね（笑）", speech: "そうだね（笑）" }, [], common),
  ).toBe("そうだね");
});

/** プレーンな段落でできた章と、それぞれについて読まれる内容。 */
function chapter(lines: string[]): Paragraph[] {
  return lines.map((text) => ({ text, speech: text }));
}
function spoken(
  paragraphs: Paragraph[],
  bookEntries: Parameters<typeof paragraphSegments>[3],
  commonEntries: Parameters<typeof paragraphSegments>[4] = [],
): string[] {
  return paragraphs.map(
    (_, index) =>
      paragraphSegments(paragraphs, index, [], bookEntries, commonEntries)[0]
        ?.speech ?? "",
  );
}

it("keeps the mark of a rule matched over paragraphs when reading the saved dictionary", () => {
  expect(
    toDictionary({
      common: [
        {
          surface: "^<あとがき>$[\\s\\S]*",
          reading: "",
          regex: true,
          multiline: true,
        },
        { surface: "一", reading: "いち", multiline: "yes" },
      ],
    }).common,
  ).toEqual([
    {
      surface: "^<あとがき>$[\\s\\S]*",
      reading: "",
      regex: true,
      multiline: true,
    },
    { surface: "一", reading: "いち" },
  ]);
});

it("leaves everything from a paragraph to the end of the chapter unread", () => {
  const paragraphs = chapter([
    "本文です。",
    "<あとがき>",
    "お読みいただき",
    "感謝します。",
  ]);
  const rule = {
    surface: "^<あとがき>$[\\s\\S]*",
    reading: "",
    regex: true,
    multiline: true as const,
  };
  expect(spoken(paragraphs, [rule])).toEqual(["本文です。", "", "", ""]);
  // 全作品共通の辞書からでも同じ。オフにしたときは適用されない。
  expect(spoken(paragraphs, [], [rule])).toEqual(["本文です。", "", "", ""]);
  expect(spoken(paragraphs, [{ ...rule, off: true }])).toEqual(
    paragraphs.map((paragraph) => paragraph.text),
  );
  expect(
    chapterReplacements(paragraphs, [{ ...rule, off: true }], []),
  ).toBeNull();
});

it("leaves only a range of paragraphs unread, reading its reading once", () => {
  const paragraphs = chapter(["前。", "<注>", "注の中。", "</注>", "後。"]);
  const range = "^<注>$[\\s\\S]*?^</注>$";
  expect(
    spoken(paragraphs, [
      { surface: range, reading: "", regex: true, multiline: true },
    ]),
  ).toEqual(["前。", "", "", "", "後。"]);
  expect(
    spoken(paragraphs, [
      { surface: range, reading: "注は省略", regex: true, multiline: true },
    ]),
  ).toEqual(["前。", "注は省略", "", "", "後。"]);
});

it("matches plain text with a line break over two paragraphs, part of each", () => {
  const paragraphs = chapter(["続きは次回", "お楽しみに！またね"]);
  expect(
    spoken(paragraphs, [
      { surface: "次回\nお楽しみに！", reading: "", multiline: true },
    ]),
  ).toEqual(["続きは", "またね"]);
});

it("lets a rule matched over paragraphs win over ruby and the other rules", () => {
  const paragraphs: Paragraph[] = [
    {
      text: "漢字を読む。",
      speech: "かんじを読む。",
      ruby: [{ start: 0, length: 2, reading: "かんじ" }],
    },
    { text: "次の漢字。", speech: "次の漢字。" },
  ];
  expect(
    spoken(
      paragraphs,
      [{ surface: "漢字", reading: "カンジ" }],
      [
        {
          surface: "^漢字[\\s\\S]*次の",
          reading: "",
          regex: true,
          multiline: true,
        },
      ],
    ),
  ).toEqual(["", "カンジ。"]);
});

it("keeps other rules to one paragraph: ^ and $ are the ends of the paragraph", () => {
  const paragraphs = chapter(["一行目", "二行目"]);
  expect(
    spoken(paragraphs, [
      { surface: "目\\s+二", reading: "×", regex: true },
      { surface: "^二", reading: "に", regex: true },
    ]),
  ).toEqual(["一行目", "に行目"]);
  expect(
    chapterReplacements(paragraphs, [{ surface: "一", reading: "いち" }], []),
  ).toBeNull();
});

/** すべての種類のカッコに声を付けたときの、プレーンな段落の区間。 */
function stretches(
  text: string,
  kinds: Parameters<typeof speechSegments>[1] = bracketKinds,
  common: Parameters<typeof speechSegments>[3] = [],
) {
  return speechSegments({ text, speech: text }, kinds, [], common);
}

it("reads a paragraph as one stretch when no bracket has a voice", () => {
  expect(stretches("「こんにちは」と言った。", [])).toEqual([
    { speech: "「こんにちは」と言った。" },
  ]);
  expect(speechSegments(withRuby, bracketKinds, [], [])).toEqual([
    { speech: "次はかんじです。" },
  ]);
  expect(stretches("◆◇◆", bracketKinds, [...systemRules])).toEqual([]);
});

it("reads the inside of a bracket as a stretch of its own, without the bracket", () => {
  expect(stretches("　彼は「こんにちは」と言った。")).toEqual([
    { speech: "彼は" },
    { speech: "こんにちは", bracket: "kagi" },
    { speech: "と言った。" },
  ]);
  // 半角の丸カッコは、全角のものと同じ種類。
  expect(stretches("（本当かな）(たぶん)")).toEqual([
    { speech: "本当かなたぶん", bracket: "paren" },
  ]);
});

it("goes back to the voice around a nested bracket when it closes", () => {
  expect(stretches("「先生は『急ぐな』と言ったよ」")).toEqual([
    { speech: "先生は", bracket: "kagi" },
    { speech: "急ぐな", bracket: "double" },
    { speech: "と言ったよ", bracket: "kagi" },
  ]);
  // 専用の声のないカッコは、周りの文として読まれる。
  const onlyKagi = bracketKinds.filter((kind) => kind.id === "kagi");
  expect(
    stretches("「先生は『急ぐな』と言ったよ」（たぶん）", onlyKagi),
  ).toEqual([
    { speech: "先生は『急ぐな』と言ったよ", bracket: "kagi" },
    { speech: "（たぶん）" },
  ]);
});

it("leaves a bracket that is not closed in the paragraph as text", () => {
  expect(stretches("そうだね(笑")).toEqual([{ speech: "そうだね(笑" }]);
  expect(stretches("以上」です")).toEqual([{ speech: "以上」です" }]);
  // 内側で閉じ忘れたカッコがあっても、外側のカッコは閉じる。
  expect(stretches("「そう(笑」と")).toEqual([
    { speech: "そう(笑", bracket: "kagi" },
    { speech: "と" },
  ]);
});

it("applies the readings inside each stretch, and takes no bracket from what a rule replaces", () => {
  expect(
    stretches("「小鳥遊です」と(仮)が言う", bracketKinds, [
      { surface: "小鳥遊", reading: "たかなし" },
      { surface: "(仮)", reading: "かり" },
    ]),
  ).toEqual([
    { speech: "たかなしです", bracket: "kagi" },
    { speech: "とかりが言う" },
  ]);
  // ルビも読みの一つ。
  expect(
    speechSegments(
      {
        text: "「漢字」",
        speech: "「かんじ」",
        ruby: [{ start: 1, length: 2, reading: "かんじ" }],
      },
      bracketKinds,
      [],
      [],
    ),
  ).toEqual([{ speech: "かんじ", bracket: "kagi" }]);
});
