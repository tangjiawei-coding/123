# workflow · 完整工作流

> 状态：Current · 更新时间：2026-08-04。SKILL.md 是摘要；生图后端为 Codex built-in native `imagegen`。

---

## Step 1 · 收输入并查看参考图

必收：`$PHOTO` · `$CITY_INPUT` · `$COUNTRY_INPUT`。用户可使用中文或其他语言输入。

可选：tagline/想说的话 · `$STYLE`（默认识图推荐，兜底 `classic`）· `$DENOM`（自动）· `$POSTMARK`（默认 `yes`）· `$INFO_DENSITY`（默认 `standard`）· `$TITLE_MODE`（自动）· `$ORNAMENT_LEVEL`（默认 `subtle`）· `$PRINT_MATERIALITY`（默认 `subtle`）· `$AR`（自动跟随参考图）· `$SOURCE_TEXT_POLICY`（默认 `preserve`）。

### 1a · 让图片进入上下文

- `$PHOTO` 是本地路径：先用 `view_image` 打开并检查；之后 native `imagegen` 使用 `referenced_image_paths: ["<$PHOTO>"]`。
- `$PHOTO` 已是会话中可见的附件：直接检查；若没有稳定本地路径，按 native 工具要求使用包含目标图的最小近期图片上下文。
- 不同时传本地路径和近期图片参数。不要为了适配其他后端预先缩图、转码或写临时副本；built-in 工具失败时先报告真实错误。

查看参考图时记录：宽高方向、主体/地标、前中后景、可用负空间、显著店招/品牌/路牌/铭牌、适合的标题模式、题材类别（现代城市/街拍/交通/夜景/当代建筑，或古建筑/遗址/石窟/寺庙/传统文化等），以及是否存在可读 EXIF 时间/GPS。

### 1b · 解析画面语言

只支持 `zh` / `en` / `ja` / `fr` / `ko` 五种 `$DISPLAY_LANGUAGE`：

- 中国：`zh`；中文主标题。现代城市、街拍、交通、夜景、商业街和当代建筑默认加较小标准英文地名；古建筑、遗址、石窟、寺庙、宗教建筑、传统园林、文物和传统文化主体默认不加英文。主体类别优先于所在城市类别。
- 英语国家/地区：`en`；只用英文，不重复。
- 日本：`ja`；日文主标题，可选较小英文/标准罗马字。
- 法语地区：`fr`；法文主标题，通常不加重复英文。
- 韩国：`ko`；韩文主标题，可选较小英文/标准罗马字。
- 其他目的地：统一设为 `en`，并在 `_source.md` 标记 `fallback`。例如中文输入“伊斯坦布尔” → `ISTANBUL / TURKEY`，不能自动加入中文或土耳其语新增文字。

用户输入语言只影响理解与交付命名，不决定票面语言。参考图原有文字属于 source scene，不翻译、不删除。

### 1c · 识图推荐与方向

只从 6 款核心风格中推荐 `$STYLE`：通用或条件不明确 → classic；自然风景/旅行/街景 → watercolor；老街/历史建筑/怀旧 → vintage；现代都市/年轻题材/现代人像 → risograph；古迹/民俗/东方文化 → woodblock；正式人像/纪念建筑/庄重题材 → engraved。轻松、美食、萌宠优先 watercolor，若画面更现代鲜明则用 risograph。字体按 `typography.md` 选。

本 Skill 只支持这六款风格。用户点名未列出的风格 id 时，说明当前不支持，并从六款中推荐最接近的一款。

方向由参考图宽高比决定：

- `> 1.1` → `landscape / 4:3`
- `< 0.9` → `portrait / 3:4`
- `0.9–1.1` → `square / 1:1`

这是 prompt 和成品 QA 约束。built-in `imagegen` 当前不暴露 `--ar` 参数，不能把 `4:3` 误写成工具参数。用户明确指定比例时才覆盖。

### 1d · 信息与标题模式

默认 `$INFO_DENSITY=standard`。坐标只用 EXIF GPS、用户提供的准确位置或可靠核验的具体地标/拍摄点；有可信坐标时，默认把它作为 standard 的首选微型模块，格式为 `39.8822°N · 116.4066°E`。只有城市名却无法定位具体对象时，不得拿城市中心坐标冒充拍摄坐标。建成年份、别称、地方 motto 必须由用户提供或核验；没有可信值就省略。`$ISSUE_YEAR` 只是纪念设计年份；`$SERIAL` 必须记作 `decorative / non-official`。

标题模式只选一个：

- 干净负空间 + 短标题 + 合适主体/前景 → 可选 `hero-overlay`
- 背景繁忙或文字对比不足 → `framed-label`
- 标题/tagline 较长、自然风景或构图克制 → `bottom-band`
- 条件不明确 → `bottom-band`

原图显著文字默认保留。判断会影响版式时先向用户说明并询问，不得擅自删除。

为文字系统声明明确轴线：国家名锚定内框左边缘或中心；主地名与可选英文/罗马字组成同一标题组并共用中心轴或左边缘。中文城市英文 secondary 约为中文标题高度的 30–40%；古建筑等题材从布局和 EXACT 清单中删除英文 secondary。禁止只写“靠近标题”。面值块宽度不超过内框约 15%，字高约为主标题 30–45%。默认 `$PRINT_MATERIALITY=subtle`，在不改变配色的前提下加入全票纸纤维、墨色轻微不均与边缘微磨损；邮戳使用细外环/局部内环和克制日期层级，直径约为短边 18–24%，只保留 45–60% 油墨。

---

## Step 2 · 组装 native prompt

1. 按 `SKILL.md`「参考文件」中的六款显式路径映射加载 `$STYLE`，取得 `$STYLE_ART` / `$FRAME` / `$FINISH` / `$TYPE`；不要自行拼接文件名。
2. 加载 `references/typography.md`，解析显示串、题材化中英 secondary、面值、字体与对齐；日本默认 `110円`，面值保持辅助角标尺度。
3. 加载 `references/design-system.md`，确认信息密度、坐标来源与格式、标题模式、标题组/国家页眉轴线、装饰等级、印刷材质与事实来源。
4. 加载 `references/prompt-template.md`，填入全部变量。
5. secondary 与 primary 相同或为空时整段删除；tagline 为空时删除对应布局与 EXACT 项。
6. 每个启用信息模块都记录来源：`EXIF` / `user-provided` / `verified` / `decorative`；所有可见新增字符串逐条进入 EXACT 清单。
7. 把识别到的显著原有文字写进 `SOURCE SCENE FIDELITY`，例如明确要求保留 `LAWSON`。
8. 保留方向、四边统一留白与 source signage 约束。
9. 明确邮戳直径约为短边 18–24%，采用细环、上弧地名和更小日期，只保留 45–60% 可见油墨；EXACT 清单定义其正确原始内容，但允许自然缺墨遮掉部分笔画。

将模板组装成一个完整字符串，直接作为 built-in `imagegen` 的 `prompt`。无需 `/tmp` prompt 文件，不需要 shell 转义，也不询问或传入 built-in 未暴露的 quality、resolution、size、destination-path、mode、`--ref` 或 `--ar` 参数。

---

## Step 3 · native imagegen 生图

### 3a · 确定交付命名

- 用户提供中文地点：`$LOCATION_NAME` 直接保留中文，只清理路径非法/危险字符和首尾空白。
- 没有中文地点：使用英文小写 kebab-case。
- 正式文件名：`<$STYLE>-<$LOCATION_NAME>.png`。
- 目录：`~/Downloads/postmark/<YYYYMMDD>-<$LOCATION_NAME>/`。
- 同名文件已存在时不覆盖，使用 `-v2`、`-v3` 等后缀。

### 3b · 调用 built-in imagegen

本地参考图调用概念：

```text
imagegen(
  prompt=<Step 2 完整 prompt>,
  referenced_image_paths=["<$PHOTO>"]
)
```

`$PHOTO` 必须已在 Step 1 用 `view_image` 检查。若目标图没有本地路径，使用 native 工具规定的最小近期图片上下文；两种机制不能同时使用。

工具返回后：

1. 先展示生成结果，并按工具返回的路径/提示定位生成文件。
2. 用 `view_image` 检查生成文件。
3. QA 通过后，将所选文件非破坏性复制到正式交付目录；不要假设 imagegen 调用参数能直接指定目标路径。
4. 用 `sips -g pixelWidth -g pixelHeight "<final-path>"` 记录实际像素尺寸与比例。

built-in 不可用或失败时，如实说明错误；不要静默切换到第三方后端。只有用户明确要求 native imagegen 的 CLI/API 路径时，才读取系统 `imagegen` skill 的 fallback 文档并另行确认所需环境。

---

## Step 4 · QA 与重试

加载 `references/qa-checklist.md`，使用 `view_image` 检查全图；需要看文字细节时，以原始尺寸/100% 查看或制作只读检查用裁切，不依赖专有分析 API。

必须核对：

- 五语言包/英文 fallback 与全部 EXACT 字符串
- 中国现代城市/街拍是否按题材加入小号英文 secondary；古建筑/遗址/寺庙等是否默认保持中文单语标题
- 国外目的地没有因中文输入出现新增中文
- 原图店招、品牌、路牌、铭牌按约定保留
- 标题模式只出现一个，且与场景匹配
- 国家页眉有明确内框锚点；主标题与 secondary 组成一个标题组并严格共轴，不出现悬浮辅助行
- `hero-overlay` 遮挡不破坏识别；微字有承载底板/描边
- 全票有中性纸纤维、轻微墨色起伏和边缘微磨损，且未因材质规则自动泛黄/棕褐化
- 面值保持辅助角标尺度，不大于国家名或形成第二标题
- 邮戳尺寸克制、环线与日期层级精致，且像不完整的二次油墨盖印，不像完整锐利的矢量徽章或粗糙橡皮章
- 有可信具体地点坐标时使用单行微字；坐标、年份、别称、序号与来源记录一致，不用城市中心冒充拍摄点
- 齿孔、国名、面值和可选邮戳齐全
- 横/竖/方方向正确
- 邮票外缘含阴影距四边均约为短边 4%，任意边差不超过短边 1%

不通过时最多重试 2 次，每次只针对一个主要问题调整 prompt，并继续引用同一参考图。重试文件使用 `-r1` / `-r2`；最终通过版复制为正式名或安全版本名。两次仍失败就如实报告具体问题，不交付失败图。

---

## Step 5 · 写 `_source.md`

```markdown
# _source · postmark 邮票产出

- **主导 skill**：postmark
- **风格**：<$STYLE>（<$STYLE 中文名>）
- **生图后端**：Codex built-in native imagegen
- **模型/质量参数**：not exposed by built-in tool
- **生成模式**：reference-guided style-transfer
- **参考图角色**：scene and subject source
- **参数/结果**：orientation=<$ORIENTATION>, requested-ar=<$AR>（prompt constraint）, actual-size=<WIDTHxHEIGHT>, canvas-margin-target=4%-of-short-edge, info-density=<$INFO_DENSITY>, title-mode=<$TITLE_MODE>, title-alignment=<AXIS>, ornament=<$ORNAMENT_LEVEL>, print-materiality=<$PRINT_MATERIALITY>
- **生成时间**：<YYYY-MM-DD>
- **成品文件**：<$OUTPUT_NAME>
- **用户输入**：地点 <$CITY_INPUT> · 国家 <$COUNTRY_INPUT> · 想说的话 <原文>
- **画面语言**：<$DISPLAY_LANGUAGE> · 解析方式 <destination-pack / fallback> · 题材类别 <modern-urban / heritage / nature / other> · 国名 <$COUNTRY_PRIMARY>[ / <$COUNTRY_SECONDARY>] · 地名 <$CITY_PRIMARY>[ / <$CITY_SECONDARY>] · 标语 <$TAGLINE_PRIMARY>[ / <$TAGLINE_SECONDARY>] · 邮戳 <$POSTMARK_PLACE>
- **面值/邮戳**：<$DENOM> · <$POSTMARK>
- **信息模块**：<逐项列出变量、实际字符串与来源>
- **装饰序号**：<$SERIAL 或 omitted> · decorative / non-official

## prompt 摘要
<一两句概括>

## 完整 prompt（实际使用）
<贴本次 native imagegen 的完整 prompt>
```

不复制原照片、不记录密钥、不记录本地源文件路径。交付时告诉用户：最终图片路径、使用的风格/标题模式、native imagegen 后端，以及是否重试。
