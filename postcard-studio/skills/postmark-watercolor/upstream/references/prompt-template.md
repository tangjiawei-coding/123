# prompt-template · 一次性生图 prompt 组装

> 状态：Current · 更新时间：2026-08-04。一次性生图：邮票主图、外框和全部新增文字在同一张里生成。先完成语言包、信息来源与标题模式决策，再把选中风格的 `<fill>` 块填入结构化 prompt，直接传给 Codex built-in native `imagegen`。

## 填充顺序

1. 按 `SKILL.md`「参考文件」中的六款显式路径映射加载 `$STYLE`，取得 `$STYLE_ART` / `$FRAME` / `$FINISH` / `$TYPE`；不要自行拼接文件名。
2. 加载 `references/typography.md`，确定 `$DISPLAY_LANGUAGE`、显示串、面值、主题字体、文字路径与对齐。
3. 加载 `references/design-system.md`，选定 `$INFO_DENSITY`、一个 `$TITLE_MODE`、`$ORNAMENT_LEVEL`，并筛出有可信来源的信息模块。
4. 将所有实际启用的新增文字列入 EXACT 清单；空变量从布局和清单中整段删除。
5. 把变量和四个风格块填入下面模板，作为一次 native `imagegen` 调用的完整 prompt；不要传入 built-in 工具不存在的 quality、resolution、size、destination-path 或 `--ar` 参数。

---

## 模板

以下模板使用英文指令，精确显示串保留原文字形。

```
Use case: style-transfer
Asset type: collectible commemorative postage stamp
Input images: Image 1 is the reference scene and subject source. Preserve its recognizable composition, landmarks, storefronts, signs, and environmental text while re-rendering it as stamp art.

[ART STYLE]
<$STYLE_ART>

Create a <$ORIENTATION> <$AR> commemorative postage stamp design from the provided reference photo. Match the reference orientation: landscape references produce a landscape stamp, portrait references a portrait stamp, and near-square references a square stamp. Re-render the reference subject, scene, and composition in the art style above; do not simply reproduce the photograph.

CANVAS GEOMETRY — CRITICAL:
Center the complete physical stamp on a clean neutral canvas. From the outermost visible perforations and soft shadow, leave the SAME clear margin on the top, right, bottom, and left, each approximately 4% of the canvas's shorter dimension. The difference between any two margins must remain within 1% of that shorter dimension. No perforation or shadow may touch or be clipped by the canvas edge. Keep the stamp level and untilted.

SOURCE SCENE FIDELITY:
Preserve the reference photo's existing storefront signs, brand marks, road signs, building inscriptions, and other recognizable environmental text by default. Re-render prominent source text and marks as faithfully and legibly as the chosen style permits. Do not remove, blur, simplify, replace, anonymize, or turn a text-bearing sign into a blank surface unless the user explicitly requested it. These source-scene elements are separate from the new stamp typography listed below.

DISPLAY LANGUAGE:
Use the resolved display-language pack "<$DISPLAY_LANGUAGE>" for all newly added stamp typography. Supported packs are zh, en, ja, fr, and ko; unsupported destination languages must use the en fallback. The user's input language does not control on-stamp language. Do not add Chinese translation to a foreign destination merely because the user wrote the destination in Chinese. Japanese and Korean may use smaller English or standard romanization only when the secondary strings below are explicitly provided. For the zh pack, modern cityscapes, street photography, transport, nightlife, commercial streets, and contemporary architecture should normally use a smaller English destination secondary when explicitly supplied; ancient architecture, ruins, grottoes, temples, religious sites, heritage gardens, artifacts, and traditional-culture subjects should normally omit it. The subject category overrides the surrounding city's modern identity. English must not be duplicated.

COMPOSITION SYSTEM:
- Information density: "<$INFO_DENSITY>". Use only the explicitly enabled modules below; do not fill empty space with pseudo-text.
- Title mode: "<$TITLE_MODE>". Use exactly ONE of the following matching instructions:
  [if bottom-band] Place the destination title and optional tagline in a dedicated lower information band. Give the lettering a quiet solid or near-solid backing separated from the scene.
  [if hero-overlay] Set the short destination title at oversized scale in a clean background/negative-space layer. Let a real subject or foreground element from the reference scene overlap only about 10–20% of the title to create depth. Keep every essential character recognizable. Do not invent a landmark or foreground prop for the overlap.
  [if framed-label] Place the destination title in a legible cartouche, plaque, ribbon, geometric label, or culturally relevant ornamental container. The container must separate the title from the busy scene.
- Ornament level: "<$ORNAMENT_LEVEL>". Match the frame and ornament to the selected style and destination. Use neutral geometry when no reliable regional motif is available. Never copy city-specific emblems or motifs from unrelated example stamps.

ALIGNMENT GRID — CRITICAL:
Treat the destination primary and optional destination secondary as ONE title group. State one explicit anchor for that group: if centered, both lines share the exact same center axis; if left-aligned, both lines share the exact same left edge. Place the secondary directly beneath the FULL primary title, not beneath an individual character or at an unrelated nearby position. Anchor the country label separately to either the inner-frame left edge or the inner-frame center axis. Do not create a third floating alignment axis. Align denomination and micro-information to the inner frame or to one shared container edge. Keep the denomination as a small supporting corner label, never a second headline.

LAYER ORDER:
1. neutral canvas and uniform clear margin;
2. perforated stamp paper, outer frame, corner details, and paper texture;
3. scene background and, only for hero-overlay, the background title;
4. principal subject or landmark in the middle ground;
5. an optional foreground occluder derived from the reference scene;
6. denomination, title container, information modules, postmark, and final keylines.

STAMP INFORMATION HIERARCHY:
- Country primary: "<$COUNTRY_PRIMARY>". [If non-empty and different] add smaller country secondary "<$COUNTRY_SECONDARY>".
- Destination title primary: "<$CITY_PRIMARY>" in <$TITLE_FONT>. [If non-empty and different] add smaller title secondary "<$CITY_SECONDARY>".
- [If provided] Tagline primary: "<$TAGLINE_PRIMARY>". [If non-empty and different] add smaller tagline secondary "<$TAGLINE_SECONDARY>".
- Denomination in one corner: "<$DENOM>". Keep the whole denomination block within about 15% of the inner-frame width and about 30–45% of the primary-title height. It must not exceed the country-label size. Currency symbols or unit glyphs may be 60–70% of the numeral height.
- [If $POSTMARK=yes] Add one refined but physically imperfect circular cancellation whose original stamp text is "<$POSTMARK_PLACE>" and "<$DATE>". Size its diameter to about 18–24% of the stamp's shorter side. Use one thin outer ring, one partially visible finer inner ring, the place name along the upper arc, and a smaller narrow date centered or set along the lower arc; optionally add 2–4 fine killer bars when appropriate. Keep only about 45–60% visibly intact and about 25–45% as dark as the main printed ink: broken ring segments, uneven pressure, dry-ink gaps, slight feathering, and a natural 3–7 degree rotation. Add no star, shield, flourish, or pseudo-official emblem. It may cross an inner keyline but must not cover essential title, denomination, or coordinate content. It must look like a finely typeset second-pass cancellation with naturally failed ink transfer, never a complete vector badge or crude oversized rubber stamp.
- Enabled information modules, placed as restrained microtypography or small framed labels:
<$ENABLED_INFO_MODULES>

INFORMATION TRUTHFULNESS:
Every enabled factual module has already been sourced from EXIF, the user, or a verified source. Render only those supplied values. [If enabled] Treat "<$ISSUE_YEAR>" as the commemorative design year, never as a claim of official postal issue. [If enabled] Treat "<$SERIAL>" as a decorative non-official design number. Do not invent coordinates, dates, established years, epithets, mottos, country codes, institutional names, official seals, or issue claims.

FRAME & FINISH:
<$FRAME>. Printed finish: <$FINISH>. Print materiality: "<$PRINT_MATERIALITY>". For the default "subtle" setting, carry neutral paper fibers, slight ink-density variation, tiny absorption grain, and minimal rubbing along perforations and keylines across the ENTIRE stamp, including the illustrated scene. Preserve the selected style's original palette. Do not add yellowing, sepia toning, brown vintage grading, grime, stains, or heavy aging unless the selected style or user explicitly asks for them. The result should read as a real physical collectible stamp, with a soft realistic shadow fully contained within the four-sided margin.

TYPOGRAPHY & CONTRAST:
Use <$TYPE> for country, denomination, microtype, and supporting labels, adapted to the resolved writing system. Use <$TITLE_FONT> for the main title. Text path: <$TEXT_PATH>. Alignment: <$ALIGN>. The primary destination title is the strongest typographic element; any secondary line is clearly smaller and shares the title group's declared alignment axis. When the zh pack enables an English city secondary, set it at about 30–40% of the Chinese title height, with lighter weight and restrained tracking.

Use the darkest ink in the palette for the main title on light paper, or the lightest paper color on a solid dark plaque. Maintain strong title/background contrast, visually comparable to 4.5:1. At thumbnail size the title must remain identifiable; at 100% size all essential title, denomination, and information-module characters must be clear. The denomination remains subordinate: no more than about 15% of the inner-frame width and 30–45% of the main-title height. Never place coordinates, serial numbers, mail labels, or other microtype directly over high-frequency scene detail: give them a solid or near-solid backing, a fine outline, or a keyline. If coordinates are enabled, render the supplied exact coordinate string as one narrow microtype line in decimal degrees with four places, around 55–70% of the country-label height. The postmark is the deliberate exception: its intended string must be correct, but physical ink loss may obscure parts of its ring and letters. Texture must not damage other essential text.

NEW STAMP TYPOGRAPHY — CRITICAL:
Render every enabled string below EXACTLY, character for character: no substitution, extra characters, invented text, misspelling, mirrored text, or reversed characters. Existing source-scene text remains governed by SOURCE SCENE FIDELITY and may appear in addition to this list.
- Country primary: "<$COUNTRY_PRIMARY>"
- Country secondary: "<$COUNTRY_SECONDARY>"   [only if non-empty and different]
- Title primary: "<$CITY_PRIMARY>"
- Title secondary: "<$CITY_SECONDARY>"   [only if non-empty and different]
- Tagline primary: "<$TAGLINE_PRIMARY>"   [only if provided]
- Tagline secondary: "<$TAGLINE_SECONDARY>"   [only if non-empty and different]
- Denomination: "<$DENOM>"
- Postmark source text: "<$POSTMARK_PLACE>" / "<$DATE>"   [only if $POSTMARK=yes; render no wrong glyphs, but natural dry-ink loss may hide parts of the correct source text]
<$ENABLED_INFO_EXACT_STRINGS>

Do not invent any additional stamp caption, watermark, logo, signature, pseudo-text, or decorative lettering. This restriction applies to newly added design typography and does not authorize removing text or logos already present in the reference scene.
```

---

## 条件块组装

### 标题模式

- 三种模式只保留选中的一段，删除另两段及方括号提示。
- `hero-overlay` 不是默认大标题模板。仅当负空间干净、标题较短且参考场景已有合适前景/主体时启用。
- `hero-overlay` 的 10–20% 是视觉遮挡上限，不是必须遮到该比例；任何关键字无法识别都改用 `framed-label` 或 `bottom-band`。

### 信息模块

`$ENABLED_INFO_MODULES` 只列实际启用的布局行，例如：

```
  • Coordinates: "41.0082° N, 28.9784° E"
  • Place epithet: "BOSPHORUS"
  • Design year: "2026 ISSUE"
  • Decorative serial: "TR · 00156 · 2026"
```

同样把这些字符串逐条写入 `$ENABLED_INFO_EXACT_STRINGS`。没有启用模块时，将两处占位符和前面的说明行一并删除，不保留空项目符号。

`$ISSUE_YEAR` 或 `$SERIAL` 未启用时，同时删除 `INFORMATION TRUTHFULNESS` 段中对应的条件句和占位符，不能把空字符串送给模型。

- `minimal`：不主动加事实型微字；最多保留一行 tagline。
- `standard`：除固定元素外，默认加设计年份、国家代码/装饰序号，并在坐标/别称/航邮标签中最多选一项。有 EXIF、用户提供或具体地点核验坐标时，优先选择坐标；画面繁忙时可以更少。
- `archival`：只在来源可靠且版面允许时增加模块，微型模块总数不超过 4 项。

### 其他变量

- `$DATE`：优先读照片 EXIF `dateTimeOriginal`；读不到则问用户旅行日期；都没有才用今天并说明。格式 `MMM DD YYYY`。
- `$COORDINATES`：只用 EXIF GPS、用户提供的准确位置或核验过的具体地标/拍摄点；只有城市名时不得用城市中心代替。默认格式为十进制度保留四位：`39.8822°N · 116.4066°E`。
- tagline 为空：删除布局、EXACT 清单和所有占位符对应行。
- secondary 为空或与 primary 相同：从布局与 EXACT 清单中删除，不能留下重复行。`zh` 现代城市/街拍/交通/夜景/商业街/当代建筑默认提供标准英文 secondary；古建筑/遗址/石窟/寺庙/传统文化主体默认删除 secondary，除非用户明确要求。
- 国名太长：可使用当地常见短形，但必须先得到准确显示串；不要靠模型自行缩写。
- 显著原图文字：识别后追加明确句子，例如 `Preserve the prominent storefront word "LAWSON" from the reference scene.`。如判断会影响版式，先询问用户。
- `$PRINT_MATERIALITY`：默认 `subtle`，只增加中性纸纤维、墨色起伏和边缘微磨损，不改变原风格配色；只有用户明确要求或 `vintage` 风格需要时才加入泛黄/棕褐/重做旧。
- 对齐：把国家页眉锚点与标题组锚点写成具体关系。primary/secondary 共用同一中心轴或同一左边缘，禁止使用 `near the title` 代替轴线说明。
- 面值：整个块宽度不超过内框约 15%，字高约为主标题 30–45%；币种符号/单位可为数字高度 60–70%。
- 邮戳：EXACT 项表示原始印章内容；直径约为邮票短边 18–24%，使用细外环、局部细内环、上弧地名和小号日期，只保留 45–60% 可见油墨；允许自然缺墨遮住部分正确笔画，不把“所有微字必须完全清晰”的要求套到邮戳上。
- `$ORIENTATION` / `$AR`：宽高比 `> 1.1` 使用 `landscape / 4:3`；`< 0.9` 使用 `portrait / 3:4`；其余使用 `square / 1:1`。把方向与比例写进 prompt，并在结果中验收；built-in `imagegen` 当前不暴露 `--ar` 参数。用户明确覆盖时例外。
- QA 文字失败后重试：在 EXACT 段前加 `The text must be perfectly legible and correct — this is the most important requirement.`，并减少非必要微字，不能通过编造短词解决。

## Native imagegen 调用约束

- 本地 `$PHOTO` 先用 `view_image` 查看，再通过 `referenced_image_paths: ["<$PHOTO>"]` 传给 built-in `imagegen`。
- 会话附件已可见但没有稳定本地路径时，按 native 工具要求使用最小必要的近期图片上下文；不要同时传 `referenced_image_paths` 与近期图片参数。
- 将本模板组装后的全文直接作为 `prompt`；无需 `/tmp` prompt 文件，也不做 shell 转义。
- built-in 输出先按工具结果展示并用 `view_image` 检查。需要正式交付时，按工具返回的路径/提示定位产物，再非破坏性复制到目标文件夹；不要假设调用参数能直接指定输出路径。
- 重试时一次只修改一个失败点，继续引用同一原图；不得在重试中放松 source-scene signage、语言或事实来源约束。
