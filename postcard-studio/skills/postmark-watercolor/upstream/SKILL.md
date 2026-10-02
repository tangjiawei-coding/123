---
name: postmark
description: 为 Codex 将旅行或风景照片制作成精美的纪念邮票：按所选艺术风格重绘照片作为主图，配以齿孔边、国名、面值、可选邮戳和可验证的档案信息，并通过五种目的地语言包、三种可选标题模式与分层构图完成排版。适用于用户提出“做成邮票”“把照片做成邮票”“旅行邮票”“风景邮票”“邮票纪念图”“stamp”“postmark”，或希望把照片制作成邮票、明信片纪念品时。
---

# postmark · 旅行照片 → 邮票

> 把一张旅行/风景照片，做成一枚精致的**纪念邮票**：主图按所选风格重绘，外包真邮票（齿孔边 + 国名 + 面值 + 可选邮戳），按目的地选择五种显示语言之一，并按画面条件选用一种标题模式。默认使用 Codex 内置 native `imagegen`，以原照片作为场景/主体参考，一次生成图与文字。

---

## 触发词

`做成邮票` / `把照片做成邮票` / `旅行邮票` / `风景邮票` / `邮票纪念图` / `stamp` / `postmark`

---

## 核心变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `$PHOTO` | （必填） | 用户提供的照片本地路径或会话附件；本地文件先用 `view_image` 检查，再作为 native `imagegen` 参考图 |
| `$STYLE` | `classic` | 6 款核心风格 id 见下方速查；未指定时按识图推荐，无法判断才用 `classic` |
| `$SCENE_CATEGORY` | 自动 | `modern-urban` / `heritage` / `nature` / `other`；主要用于决定中文地名是否默认加英文 secondary |
| `$CITY_INPUT` / `$COUNTRY_INPUT` | （必填） | 用户输入，可为中文或其他语言；只用于理解地点与交付命名 |
| `$DISPLAY_LANGUAGE` | 自动 | 五种语言包之一：`zh` / `en` / `ja` / `fr` / `ko`；其他目的地语言回退 `en`，与用户输入语言无关 |
| `$COUNTRY_PRIMARY` / `$CITY_PRIMARY` | （必填） | 对应语言包的国名/地名；外国目的地不因中文输入而显示中文 |
| `$COUNTRY_SECONDARY` / `$CITY_SECONDARY` | 自动/可选 | 日文/韩文可用较小英文或标准罗马字；中文现代城市/街拍默认加较小标准英文地名，古建筑/遗址/寺庙等题材默认省略；英语不重复，法语通常不加重复行 |
| `$TAGLINE_PRIMARY` / `$TAGLINE_SECONDARY` | （可选） | 标语按显示语言简洁本地化；日/韩可选较小英文辅助，不自动保留中文翻译 |
| `$POSTMARK_PLACE` | 自动 | 与 `$DISPLAY_LANGUAGE` 一致；日/韩必要时可用当地标准罗马字 |
| `$DENOM` | 自动 | 面值，按国家货币自动取（见 `typography.md`），如 `1.20元` / `110円` / `FOREVER`；作为小号角标，不成为第二标题 |
| `$POSTMARK` | `yes` | 是否叠一枚邮戳（cancellation），`yes` / `no` |
| `$INFO_DENSITY` | `standard` | `minimal` / `standard` / `archival`；控制可见信息量，不等于全部模块都启用 |
| `$TITLE_MODE` | 自动 | `bottom-band` / `hero-overlay` / `framed-label`；按负空间、标题长度与背景复杂度三选一 |
| `$ORNAMENT_LEVEL` | `subtle` | `none` / `subtle` / `rich`；装饰应匹配风格与地域，不套同一花边 |
| `$PRINT_MATERIALITY` | `subtle` | `clean` / `subtle` / `worn`；控制纸纤维、墨色起伏与边缘微磨损，不等同于泛黄或复古滤镜 |
| `$ISSUE_YEAR` / `$COUNTRY_CODE` / `$SERIAL` | （可选） | 年份、国家代码、装饰序号；序号必须在 `_source.md` 标记非官方 |
| `$COORDINATES` / `$ESTABLISHED_YEAR` / `$PLACE_EPITHET` | （可选） | 仅用 EXIF、用户提供或可靠核验的信息；standard 有具体地点可信坐标时优先用坐标微字，无法核验就省略 |
| `$MAIL_LABEL` / `$EMBLEM` / `$LOCAL_MOTTO` | （可选） | 航邮标签、图形徽记、短 motto；不得冒充真实邮政机构或发行信息 |
| `$AR` | 自动 | 跟随参考图方向：横图 `4:3`、竖图 `3:4`、近方图 `1:1`；用户可明确覆盖 |
| `$ORIENTATION` | 自动 | `landscape` / `portrait` / `square`，由参考图宽高判断 |
| `$CANVAS_MARGIN` | `4%` | 邮票外缘（含齿孔与阴影）距画布四边统一为短边的 4%，四边偏差不超过 1% |
| `$SOURCE_TEXT_POLICY` | `preserve` | 参考照片原有店招/路牌/建筑铭牌默认保留；若需简化、模糊或移除，必须先问用户 |
| `$LOCATION_NAME` | 自动 | 用户提供中文地点时直接用中文（如 `夏塔`）；否则回退英文小写 kebab-case |
| `$OUTPUT_NAME` | 自动 | `<style>-<location-name>.png`，如 `watercolor-夏塔.png` |

---

## 风格速查（需要用户选择时使用这套中文说明）

| id | 中文名 | English | 一句话 |
|----|--------|---------|--------|
| `classic` | 经典纪念邮票 | Classic Commemorative | 规范平衡，齿孔+国名+面值+邮戳齐全，最像真邮票（保底/默认款） |
| `watercolor` | 水彩手绘风 | Watercolor | 手绘水彩晕染，旅行手帐质感，风景绝配 |
| `vintage` | 复古旧邮票风 | Vintage Antique | 做旧泛黄、褪色印刷，经典老邮票，怀旧 |
| `risograph` | Risograph 孔版印刷 | Risograph Print | 半色调网点+套印错位+鲜艳专色，2026 最火不完美美学，现代艺术感 |
| `woodblock` | 版画/木刻 | Woodblock / Lino | 黑白或多色木刻（含浮世绘），文化历史感最强，配古迹民俗 |
| `engraved` | 凹版雕刻线刻 | Engraved Intaglio | 钞票/邮票雕刻凹版，人像/建筑/货币式经典，最庄重 |

> 用户没指定 → 默认 `classic`（已识图则按主体推荐，见 `workflow.md` Step 1）。本 Skill 只支持表中的六款风格，不加载未列出的风格 id。

---

## 参考文件（按需加载，别一次全读）

| 文件 | 何时加载 |
|------|---------|
| `references/styles/classic-commemorative.md` | `$STYLE=classic` 生图时 |
| `references/styles/watercolor.md` | `$STYLE=watercolor` 生图时 |
| `references/styles/vintage-antique.md` | `$STYLE=vintage` 生图时 |
| `references/styles/risograph.md` | `$STYLE=risograph` 生图时 |
| `references/styles/woodblock.md` | `$STYLE=woodblock` 生图时 |
| `references/styles/engraved.md` | `$STYLE=engraved` 生图时 |
| `references/prompt-template.md` | 组装 prompt 时 |
| `references/typography.md` | 定文字 / 取面值时 |
| `references/design-system.md` | 选择信息密度、标题模式、层次、对比度与装饰时 |
| `references/workflow.md` | 跑完整流程时 |
| `references/qa-checklist.md` | 质检时（必看，中文易错） |

---

## 工作流（摘要，详见 `workflow.md`）

1. **收输入**：`$PHOTO` + 地点/国家（用户可用任意语言）+ 想说的话（可选）+ `$STYLE`。先按目的地选择 `zh/en/ja/fr/ko` 语言包，其他语言回退英文；缺项时使用 Codex 当前可用的用户输入机制一次问齐。
2. **看参考图**：本地图片先用 `view_image` 打开，记录主体、构图、显著招牌/文字和方向；附件已在会话可见时直接使用。
3. **组装 prompt**：加载选中风格 + `typography.md` + `design-system.md` + `prompt-template.md`；判定题材类别与中文 secondary，按画面选一个标题模式，为国家标识与标题组声明明确轴线，按信息密度启用可信坐标等模块，形成结构化 prompt。
4. **native 生图**：调用 Codex 内置 `imagegen`，本地参考图通过 `referenced_image_paths` 传入；不把 CLI 的 quality/resolution/size 参数假装成 built-in 参数。
5. **QA**：加载 `qa-checklist.md`，用 `view_image` 检查成品；核对语言包、精确字符串、信息来源、标题轴线、层次/对比度、实体印刷感、邮戳真实度、邮票元素与统一边距。失败时一次只强化一个问题，最多重试 2 次。
6. **交付**：写 `_source.md`，告诉用户路径。

---

## 产出物（遵循全局约定）

```
~/Downloads/postmark/{YYYYMMDD}-{location-name}/
  <style>-<location-name>.png  ← 最终邮票，如 watercolor-夏塔.png
  _source.md         ← 主导 skill=postmark / 风格 / 后端=native imagegen /
                       实际输出尺寸·参考图角色 / 时间 / prompt 摘要 + 完整 prompt / 城市·国家·想说的话
                       （不复制原照片、不记密钥、不记本地源路径）
```

---

## 铁律

1. **只用 Codex built-in native `imagegen`**：普通生成与参考图重绘直接调用内置工具。若 built-in 工具不可用，如实说明，不静默切换后端。只有用户明确要求 imagegen CLI/API 时，才按系统 `imagegen` skill 的 CLI fallback 流程执行。
2. **本地参考图先看再传**：使用 `view_image` 检查 `$PHOTO`，再通过 `referenced_image_paths` 传给 native `imagegen`；不假设 built-in 工具有 destination-path、quality、resolution、size 或 `--ar` 参数。
3. **文字是头号翻车点**：prompt 明确 `render these EXACT strings, character for character`；中文尽量短。QA 用 `view_image` 在全图和 100% 尺度核对，错了就针对性重试。
4. **产出标注主导 skill = postmark**：native `imagegen` 是底层工具，不作为主导 skill。`_source.md` 如实记录 built-in 后端；工具未暴露的模型/质量参数写 `not exposed`，不得猜测。
5. **参考图原有文字默认保留**：店招、品牌标识、路牌、建筑铭牌等属于画面主体/环境，不因邮票新增文字的 EXACT 约束而删除。若判断其影响版式、版权风险或生成质量，先说明影响并询问用户；未经明确同意不得自行简化、模糊或移除。
6. **日本面值默认用 `110円`**：`¥` 虽可表示日元，但也用于人民币，中文语境易歧义；用户未指定时采用本地化 `円` 写法。
7. **交付路径优先使用中文地点**：用户提供中文地点时，文件夹使用 `<YYYYMMDD>-<中文地点>/`，图片使用 `<style>-<中文地点>.png`，例如 `20260804-夏塔/watercolor-夏塔.png`。没有中文地点时才回退英文小写 kebab-case。若同名成品已存在，使用 `-v2` 等版本后缀，不覆盖旧文件。
8. **邮票方向必须跟随参考图**：横图自动生成横版 `4:3`，竖图自动生成竖版 `3:4`，近方图生成 `1:1`；这些是 prompt 与 QA 约束，不是假定存在 built-in 工具参数。只有用户明确指定时才覆盖自动方向。
9. **画布四边间距必须统一**：邮票整体居中，最外侧齿孔与阴影到画布上、右、下、左的净距均为画布短边约 `4%`，四边最大偏差不超过短边 `1%`。任何一边贴边、被裁切或明显不等距都必须重试。
10. **画面语言使用五种目的地语言包**：只支持 `zh`、`en`、`ja`、`fr`、`ko`；其他目的地语言统一回退英文。外国目的地不因用户中文输入而添加中文。日/韩可附较小英文或标准罗马字，英语不重复。中文现代城市、街拍、交通、夜景、商业街与当代建筑默认加小号标准英文地名；古建筑、遗址、石窟、寺庙、宗教建筑、传统园林、文物和传统文化主体默认纯中文标题，主体类别优先于所在城市。
11. **标题模式按场景三选一**：`bottom-band`、`hero-overlay`、`framed-label` 是可替换模式，不是每个模板都强制大标题。只有干净负空间、短标题和合适前景同时成立时才可选 `hero-overlay`；遮挡约 10–20%，不得破坏关键字识别。
12. **信息模块不得虚构**：坐标、建成年份、地点别称等必须来自 EXIF、用户或可靠核验；没有就省略。有具体地点可信坐标时，standard 默认优先加入单行微字，如 `39.8822°N · 116.4066°E`；只有城市名时不得拿城市中心冒充拍摄坐标。设计年份不得伪装为真实发行年份；装饰序号不得伪装为官方编号，并在 `_source.md` 标记 `decorative / non-official`。
13. **可读性优先于装饰**：主标题必须与背景形成明确明暗反差；微型信息不能直接压在复杂纹理上，应用底板、容器、描边或 keyline。花边和地域纹样只在适合的风格/地点使用。
14. **标题组必须共用明确轴线**：主地名与辅助英文/罗马字是一个不可拆散的标题组；居中时共用中心轴，左对齐时共用左边缘。禁止只写 `near the title`，不得让辅助行悬浮在主标题某个字的左下角。国家名是独立页眉，但必须锚定内框左边缘或内框中心轴。
15. **默认加入中性实体印刷感**：`$PRINT_MATERIALITY=subtle` 时，全票加入轻微纸纤维、墨色浓淡起伏与齿孔/边框微磨损，但保持原风格配色；除 `vintage` 或用户明确要求外，不默认泛黄、棕褐化、脏污或重度做旧。
16. **邮戳必须精致且像二次盖印**：直径约为邮票短边 18–24%，使用细外环、局部细内环、上弧地名和更小日期，可选 2–4 条细 killer bars；不加无依据星章/盾徽。油墨只保留约 45–60%，有效深度约为主体深墨 25–45%，允许断线、缺墨、轻微渗化、倾斜及局部越过内框。EXACT 字符串定义其原始内容，但自然缺墨可遮掉部分笔画；不得生成错误字符，也不得做成完整锐利的矢量徽章或粗糙大橡皮章。
17. **面值只做小号角标**：整个面值块宽度默认不超过内框约 15%，字高约为主标题 30–45%，且不得大于国家名。货币符号/单位可缩到数字高度 60–70%；与其他元素冲突时优先缩小面值，不让它成为第二标题。

---

## 版本

`v1.0.0` · 2026-08-04 · 首个公开版，面向 Codex native `imagegen`。迭代记录见 `CHANGELOG.md`
