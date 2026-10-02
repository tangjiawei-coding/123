# Ukiyoe_Picture_Skill_v1.2

## 0. Skill 定位

这是一个“现代浮世绘 / 木版画海报”生图 Skill。

目标不是复刻某一位具体画师，而是稳定生成以下视觉特征：

- 日本木版画、浮世绘、新版画式的平面美学
- 米白和纸底、轻纸纤维、轻旧化
- 黑色或深墨色木刻轮廓与大色块
- 克制、低饱和、略带复古感的配色
- 画面主体被“版画边框 / 窗框 / 切角框景”收束
- 保留安静留白，不堆砌元素
- 可加入少量文字元素，但文字只服务于构图与气质
- 不追求照片级真实，不使用强烈 3D、CG、电影光效
- 不做“脏噪点 + 过度纹理”的伪古风

---

## 1. 风格核心 DNA

生成时优先保证以下 8 点：

1. **平面化**
   - 以平涂色块为主。
   - 建筑、人物、树木、山水拥有明确外轮廓。
   - 阴影以分区色块表示，不做真实光追。

2. **木刻线**
   - 使用干净、略有手工感的深色轮廓线。
   - 线条允许轻微不规则，但不能毛躁、破碎、脏乱。

3. **和纸底**
   - 使用 warm ivory / aged washi paper。
   - 只保留细微纸纤维与轻颗粒。
   - 禁止粗糙沙砾、严重做旧、重颗粒。

4. **框景**
   - 画面通常有深墨色边框。
   - 可用切角矩形、圆角切角、六边形、窗棂式框景。
   - 边框外留米白纸张空间。

5. **借景式构图**
   - 可利用窗、门、树枝、屋檐、桥、云带形成前景或分层。
   - 主体不一定居中。
   - 常用“一侧重、一侧空”的非对称平衡。

6. **低饱和配色**
   - 以深蓝、青灰、墨绿、米白、灰紫、土红为主。
   - 朱红只作为强调色，不要大面积铺满。

7. **克制的文字元素**
   - 可出现竖红题签、小纸签、朱印、场景小注。
   - 文字元素是辅助，不要压过主体。
   - 允许有层级感，但不做满屏排版。

8. **克制**
   - 一张图只保留 1 个主视觉。
   - 常规只搭配 2~5 个辅助元素。
   - 不要把樱花、月亮、鸟居、塔、桥、云、水、印章全塞进去。

---

## 2. 默认色板

### A. 空景 / 水面 / 建筑

- charcoal black
- deep indigo
- muted navy
- slate blue
- blue gray
- desaturated teal
- moss gray-green
- warm ivory
- dusty vermilion
- muted rust red

### B. 植物 / 花景 / 人物

- dusty pink
- muted coral
- pale blush
- mauve gray
- sage green
- olive gray
- muted celadon
- light blue gray
- warm beige
- faded plum

### C. 场景扩展色板

- 夏晴：cobalt blue, cloud ivory, muted teal, pale grass green, warm ivory
- 雨景：blue gray, wet charcoal, mist gray, muted green, paper ivory
- 黄昏：dusty peach, mauve gray, indigo shadow, muted rust, warm ivory
- 宫殿：aged red, dark teal, stone white, muted gold, ink black
- 列车旅行：muted red, slate blue, reflection blue, cloud ivory, charcoal
- 荒原湖岸：yellow green, olive gray, bright water blue, pale sand ivory, deep shadow green

### 配色原则

- 70%：主背景低饱和色
- 20%：主体深色
- 10%：朱红、粉、金黄等强调色
- 同一张图尽量控制在 4~7 个主要色相
- 禁止霓虹色、荧光色、高纯度赛博配色

---

## 3. 构图模板

### 模板 A：塔 / 建筑 + 枝景前景

适用于：古塔、寺庙、城楼、神社、古建筑

- 主建筑位于中央偏上
- 花枝或树枝从下方或侧边侵入
- 建筑下部可被枝景遮挡
- 大面积天空作为负空间
- 外围使用切角矩形框
- 可配 1 条竖红题签

关键词：

`pagoda silhouette, flowering branches in the foreground, asymmetrical composition, clipped-corner woodblock frame`

---

### 模板 B：月夜 + 水面

适用于：夜景、湖泊、海边、水乡、桥梁、鸟居

- 月亮放在上方 1/3 区域
- 水面占下半部分
- 使用长条月光倒影
- 建筑或景物作为深色剪影
- 云层保持横向分层

关键词：

`moonlit water, layered clouds, long reflected moonlight, dark silhouette, quiet night scene`

---

### 模板 C：借景窗框

适用于：园林、室内看风景、古典建筑、人物半身、山水

- 使用圆窗、六角窗、扇形窗或中式 / 日式窗棂
- 窗框成为第一层构图
- 主景出现在窗后
- 窗外更亮，室内更暗

关键词：

`borrowed scenery composition, decorative lattice window framing, garden beyond the window`

---

### 模板 D：主体 + 大留白

适用于：单人角色、武者、动物、器物、武器

- 主体偏左或偏下
- 另一侧保留较大空白
- 可用云、月、烟、花瓣连接视觉
- 文字元素放在空白一侧

关键词：

`large negative space, off-center subject, minimal woodblock composition`

---

### 模板 E：分割式版画

适用于：多地点、四季、多象征物、叙事拼版

- 2~4 个大小不同的画面窗口
- 各窗口保持统一色板
- 分割区域之间保留和纸底
- 禁止现代杂志式拼贴

关键词：

`multi-panel woodblock layout, asymmetrical paper collage, unified ukiyo-e palette`

---

### 模板 F：地平线 / 交通工具 + 镜面倒影

适用于：火车、电车、船、骑行者、马队、盐湖、潮滩、浅水面

- 地平线放在画面中部或略偏下
- 主体沿横向移动，避免正中呆板摆放
- 水面或浅滩保留断续、拉长的倒影
- 天空占较大比例
- 远山压低，仅作为水平锚点

关键词：

`long horizontal subject, reflective shallows, broken mirrored reflection, distant low mountains, expansive sky, calm travel scene`

---

### 模板 G：巨幅天空 + 小主体

适用于：积云、风暴前云墙、日落云层、远行列车、海面小船、孤塔

- 55%~75% 画面交给天空
- 主体缩小到画面下方 1/4~1/3
- 云层使用 2~4 级平面色块，不做真实体积云
- 利用尺度对比制造辽阔感

关键词：

`monumental layered cloudscape, tiny grounded subject, expansive negative space, flat carved cloud masses`

---

### 模板 H：宫殿 / 城楼 + 中轴秩序

适用于：故宫、宫殿、城门、城楼、王府、中国古建筑群

- 允许较稳定的近中轴构图
- 主殿或城楼保持清晰轮廓、台基、门洞等识别点
- 前景使用石阶、御道、松梅、薄云中的 1~2 种
- 背景建筑逐层简化成色块
- 保持中国建筑身份，不自动加入鸟居或日式塔

关键词：

`monumental palace architecture, layered roof silhouettes, restrained axial composition, Chinese architectural identity preserved`

---

### 模板 I：人物 + 季节枝景

适用于：和服人物、汉服人物、武者、文人、旅人、单人半身 / 全身

- 人物偏左或偏右，占画面 35%~55%
- 另一侧保留题签或环境留白
- 花枝、枯枝、竹叶、芦苇等只选一种
- 衣纹用大色块，脸部简化
- 背景只保留远山、水面、建筑剪影中的 0~2 种

关键词：

`off-center figure, seasonal branch framing, simplified facial features, flat textile patterns, calm negative space`

---

### 模板 J：山水层叠 / 远景纵深

适用于：山川、峡谷、雪山、湖泊、江河、云海

- 前景深色，中景青灰，远景米白或浅蓝灰
- 用 3~5 层平面山体制造纵深
- 不依赖真实空气透视和电影雾效
- 可加入孤舟、桥、亭、鸟群作为尺度参照

关键词：

`layered mountain planes, carved contour ridges, atmospheric flat color separation, poetic landscape depth`

---

## 4. 主体处理规则

### 建筑
- 轮廓优先
- 屋檐结构清晰
- 避免过多砖瓦微细节
- 远处细节可简化成木刻色块
- 不应呈现写实摄影透视感

### 人物
- 五官简洁、克制
- 不做超写实皮肤
- 面部允许轻微朦胧、概括
- 衣褶以 3~6 个主要色块表达
- 不做高反光皮革、塑料感、3D 建模感

### 花木
- 花瓣以小型扁平色块表现
- 不能像摄影散景
- 枝干用有节奏的木刻线
- 前景花可以遮挡主体，但不可完全糊住主体轮廓

### 水面
- 使用水平波纹、碎亮面或断续刻线
- 倒影可以拉长、断裂、简化
- 不做真实镜面反射
- 不做复杂焦散

### 云雾
- 分层的浅色或深色平涂
- 边缘略有手刻不规则
- 不使用真实体积云

---

## 5. 元素库

生成时按题材自动挑选，常规总数控制在 **2~5 个辅助元素**。

### 天空 / 天气
- 夏季积云
- 薄云带
- 春雨 / 细雨线
- 稀疏飘雪
- 雾带 / 山雾
- 朝霞 / 晚霞
- 淡月轮
- 少量星点

### 山水 / 地貌
- 远山、雪山、丘陵、峡谷、岩壁
- 河流、湖泊、海面、潮滩、盐湖、浅水镜面
- 稻田、草坡、荒原、沙洲、湿地
- 冰面、雪原、云海

### 植物
- 樱花
- 梅花
- 枫叶
- 松树
- 竹
- 芦苇 / 芒草
- 荷叶 / 莲花
- 紫藤
- 枯枝
- 柳枝

### 建筑 / 人造物
- 中国题材：宫殿、城楼、牌楼、亭、廊、石桥、城墙
- 日本题材：神社、寺院、鸟居、五重塔、町屋、木桥
- 现代 / 近现代：列车、电车、站台、路灯、街屋、码头
- 乡野题材：木屋、渡口、栈桥、石阶、田埂

### 小型叙事元素
- 飞鸟 / 雁阵 / 乌鸦
- 纸伞
- 灯笼
- 风铃
- 小舟
- 风筝
- 旗幡
- 远处行人
- 马匹 / 鹿 / 鹤
- 石灯、石碑、界桩
- 炊烟 / 薄烟

### 动势与气氛
- 落花：3~12 片即可
- 飘雪：稀疏
- 雨线：方向统一
- 水波：横向、断续、简化
- 倒影：拉长、断裂、偏色
- 鸟群：3~7 只为宜

---

## 6. 文字元素系统（v1.2 重点新增）

### 6.1 文字元素目标

文字元素不是装饰垃圾，也不是满屏说明文字，而是用于：

- 增加“版画 / 海报 / 纸本作品”气质
- 帮助构图形成视觉停顿
- 增加层级与叙事感
- 让画面更像成品，而不只是风格滤镜图

### 6.2 可用文字元素类型

#### A. 主题签（主标题）
- 默认优先使用 1 条窄竖红题签
- 位置：右上、左上、右侧边缘最常见
- 内容：2~4 个汉字最佳，也可 4~6 字
- 风格：手写感、书法感、细长排版
- 用途：作为主标题或意境标题

可用格式示例（规则，不是固定照抄）：
- 「浮生若梦」
- 「春山远」
- 「云水行」
- 「晚照」
- 「清秋」
- 「旅途」

#### B. 副纸签（说明纸片）
- 可额外加入 1 张米白、浅灰紫或淡米色小纸签
- 位置：靠近主标题、画面上部空白区、边角、月亮附近、树枝旁
- 形式：小矩形纸片、微倾斜贴纸、细窄横签
- 内容：4~12 个字的短句、题记、注释
- 不能比主标题更抢眼

适合内容方向：
- 短句：如“风起云归”“山静水长”
- 题记：如“写于夏日湖岸”
- 一小句诗意文字，但必须简短

#### C. 场景小注（caption）
- 可在边缘、底部、空白处加入 1 行极小横排注记
- 字号很小，主要用于气质点缀
- 格式推荐：`地点 — 时间 — 天气 / 情绪`

格式模板：
- `湖岸 — 夏日午后 — 微风`
- `宫城 — 薄暮 — 微雨`
- `山路 — 春末 — 云开`
- `SALAR — 14:20 — rain coming`（需要异国语感时才用）

#### D. 朱印 / 圆章 / 邮戳
- 可加入 1 枚小型朱印
- 也可加入淡墨色圆形邮戳或旅行章
- 位置：角落、题签附近、底部留白区
- 作用：增加纸本完成度
- 尺寸必须小，不能成为主视觉

#### E. 边缘总标题（仅海报 / 版式图可选）
- 如果整张图不是单纯插画，而是海报 / 对比图 / 展示卡片
- 可在画外上方或中上部加入 1 行居中文字标题
- 字体风格应极简、疏朗
- 适合：`「对比图」`、`「旅途」`、`「湖岸纪行」`
- 普通单幅插画默认不开启该模式

### 6.3 文字元素数量规则

- 默认：`主标题 1 + 朱印 0~1`
- 丰富版：`主标题 1 + 副纸签 0~1 + 场景小注 0~1 + 朱印 0~1`
- 普通单幅插画总文字元素建议 **1~4 组**
- 如果主体复杂，文字数量自动减半
- 如果本身是头像或手机壁纸，可只保留 0~2 组

### 6.4 文本内容规则

- 优先使用 **简短中文**、**简短英文小注**、**抽象书法痕迹**
- 禁止生成乱码式假日文作为主要信息
- 不要生成大段诗文
- 不要把长句排成大块正文
- 若用户未指定内容，可自动生成与场景匹配的短标题
- 若用户明确给文字，则优先按用户提供内容执行

### 6.5 文字元素的视觉规则

- 主标题面积控制在画面宽度的 5%~10%
- 副纸签面积通常小于主标题
- 场景小注要小、轻、远离主视觉中心
- 印章只作点缀，通常不超过小题签面积的 60%
- 文字不要压住主体头部、面部、关键轮廓
- 尽量利用留白放置，不破坏呼吸感

### 6.6 默认触发逻辑

- **普通插画**：默认加主标题；按留白情况决定是否补小纸签或朱印
- **海报感更强**：自动启用“主标题 + 副纸签 + 朱印”
- **旅行 / 风景题材**：可加场景小注或邮戳
- **人物题材**：以题签为主，不要加过多说明文字
- **建筑 / 故宫 / 古塔**：适合主标题 + 小纸签 + 印章
- **壁纸**：若用户没要求，可弱化文字元素，避免影响使用

---

## 7. 文化身份保持

- 只转换视觉语言，不改变题材文化身份。
- 中国宫殿不要自动加入鸟居、日式灯笼或五重塔。
- 欧洲建筑不要强行改成和式屋檐。
- 现代列车、汽车、城市可以木版画化，但保留其时代轮廓与结构。
- 人物服装以原设定为准；和服、汉服、军服、现代服装不得相互替换。
- 题签、印章、纸签只是版面符号，不代表主体必须日本化。

---

## 8. 参考图改写模式

当用户上传参考图并要求“用这个 Skill 改写 / 转成这个风格”时：

1. 优先保留原图构图骨架：主体位置、画面方向、地平线、主要遮挡关系。
2. 保留关键识别点：人物服装、车辆轮廓、建筑屋顶、桥梁、山体、动物位置等。
3. 保留大色彩关系：不要随意把白天改成夜景，或把绿地改成樱花海。
4. 将摄影质感转换为：
   - flat woodblock color blocks
   - carved ink contours
   - simplified shadows
   - restrained washi texture
   - slightly faded pigment
5. 云层、水面、反光、草地、雪面等全部重新解释为版画语言，而不是简单叠纸纹滤镜。
6. 若原图留白足够，可自动加入适量文字元素。
7. 除非用户明确要求，不新增会改变叙事的主要物体。

---

## 9. 质感规则

允许：
- subtle washi fiber
- delicate paper grain
- slightly uneven ink coverage
- very light print misregistration
- soft faded pigment
- restrained aged-paper tone
- slight bokashi-style gradation on sky or water

禁止：
- heavy film grain
- dirty scratches
- dust storms
- grunge overlay
- extreme distress texture
- heavy noise
- fake VHS artifacts
- plastic digital painting
- glossy 3D rendering

### 可选版画技法词（少量使用）

按需加入 1~2 项即可：

- `bokashi-style soft color gradation`
- `slightly uneven hand-printed ink`
- `subtle color misregistration`
- `dry-brush carved texture`
- `blind-embossed paper impression`

使用原则：
- 一张图最多 1~2 种版画技法特征
- 技法效果不能盖过主体
- 不把做旧当作主要视觉

---

## 10. 风格强约束

每次生成必须遵守：

- 非写实摄影
- 非 3D
- 非电影概念图
- 非厚涂油画
- 非赛博朋克
- 非现代二次元赛璐璐
- 非高光塑料感
- 非复杂景深
- 非强烈镜头炫光
- 非高饱和
- 非过度细节
- 非杂乱拼贴
- 非重颗粒
- 非脏旧纸
- 非满屏文字

---

## 11. Prompt 生成器

### 基础英文 Prompt 模板

```text
A refined Japanese woodblock-print inspired illustration of [SUBJECT],
flat graphic composition, clear carved ink outlines, simplified shapes,
muted indigo, blue-gray, warm ivory and restrained vermilion palette,
subtle washi paper texture, softly faded pigments,
[COMPOSITION],
[SCENE ELEMENTS],
decorative clipped-corner woodblock frame,
[TEXT ELEMENTS],
large areas of calm negative space,
asymmetrical but balanced composition,
clean printmaking aesthetic,
quiet poetic atmosphere,
minimal fine detail, restrained texture,
no photorealism, no 3D rendering, no cinematic lighting.
```

### 文字元素 Prompt 片段库

按需从下列片段选 1~3 条加入 `[TEXT ELEMENTS]`：

```text
small vertical vermilion title cartouche near the upper-right edge
small pale paper note with delicate handwritten calligraphy
small vermilion seal stamp near the lower area
subtle horizontal caption in tiny serif type
small circular travel-postmark motif in the paper margin
```

### 中文意思

```text
一幅精致的日式木版画 / 浮世绘审美插画，主体为 [SUBJECT]。
画面采用平面化构图、清晰木刻墨线、简化造型，
使用低饱和靛蓝、青灰、暖米白和少量朱红，
带轻微和纸纤维、柔和褪色颜料感。
使用 [COMPOSITION] 的构图，
加入 [SCENE ELEMENTS]，
外围使用切角木版画边框，
加入 [TEXT ELEMENTS] 作为辅助版式元素，
保留较多安静留白，
非对称但视觉平衡，
整体干净、克制、诗意，
不过度刻画细节，不做写实、不做 3D、不做电影灯光。
```

---

## 12. Negative Prompt

```text
photorealistic, photography, realistic skin, 3D render, CGI,
cinematic lighting, dramatic volumetric light, lens flare,
depth of field, bokeh, glossy materials, plastic texture,
hyper-detailed, ultra sharp, HDR, neon colors,
cyberpunk, modern anime cel shading,
oil painting impasto, watercolor bleeding,
heavy grain, dirty texture, grunge, scratches,
random Japanese text, gibberish typography,
overcrowded composition, excessive ornaments,
symmetrical poster layout, modern graphic design,
busy background, strong perspective distortion,
full-page text blocks, oversized typography
```

中文约束：

```text
禁止照片感、真实皮肤、3D、CG、电影光效、体积光、镜头光晕、
景深散景、塑料质感、HDR、霓虹色、赛博朋克、现代动漫赛璐璐、
厚涂油画、水彩晕染、重颗粒、脏纹理、划痕、
随机乱码日文、过度装饰、拥挤构图、现代海报排版、强透视、
大段正文、满屏大字。
```

---

## 13. 自动执行流程

当用户说：

> “用这个风格生成 XXX”

按以下流程执行，不反复追问。

### Step 1：识别主体
提取：
- 主体是谁 / 是什么
- 场景
- 时间
- 情绪
- 是否需要人物
- 是否有关键象征物

### Step 2：提取 1 个主视觉
只选择一个核心：
- 人物
- 建筑
- 武器
- 山水
- 动物
- 事件瞬间

禁止多主角抢画面。

### Step 3：选择构图模板
优先从 A~J 中选择一个。

### Step 4：选择辅助元素
常规选择 2~4 个；若用户说“更丰富一点”，提升到 3~5 个，但必须有主次。

### Step 4.5：场景元素选择器
不要默认“樱花 + 月亮 + 鸟居”。根据语义自动选择：

- 春：樱 / 柳 / 薄云 / 春雨
- 夏：积云 / 荷 / 青山 / 水面
- 秋：枫 / 芒草 / 雁 / 土红天空
- 冬：梅 / 松 / 雪 / 枯枝
- 宫殿：松 / 梅 / 雪 / 薄云 / 石阶
- 战斗：烟 / 火星 / 旗幡 / 枯树 / 雨雪
- 旅行：列车 / 道路 / 远山 / 云层 / 倒影
- 水乡：桥 / 舟 / 柳 / 雨 / 水纹
- 人物肖像：只选 1 种植物 + 0~1 个环境符号
- 现代城市：电线 / 路灯 / 车轨 / 店屋剪影 / 雨面反光

如果参考图已有明确元素，则优先保留参考图，不执行替换。

### Step 5：确定色板
按主题自动选取最接近的色板。

### Step 6：添加框景
默认：
- 切角矩形黑边框
- 米白纸边
- 保留一块可放文字的留白区域

### Step 7：添加文字元素
默认优先：
- 主标题 1
- 朱印 0~1

若留白较多或用户想更有成品感，则可增加：
- 副纸签 0~1
- 场景小注 0~1

### Step 8：加入风格限制
始终补充：
- flat woodblock print
- muted palette
- subtle washi texture
- clean carved outlines
- restrained details
- no photorealism
- no 3D
- no heavy grain

### Step 9：生成
- 封面：纵向 2:3 或 3:4，顶部或侧边预留题签位置
- 壁纸：16:9 或 9:16，文字元素弱化
- 头像：1:1，只保留少量文字元素，不使用复杂边框
- 参考图改写：优先保留原构图，再做木版画化处理

---

## 14. 高级控制参数

用户说“更像传统木版画”：
- 增加 carved ink lines
- 增加 slightly uneven ink coverage
- 降低渐变
- 增加平涂色块
- 降低真实透视

用户说“更高级、更现代”：
- 减少题签数量
- 减少纸张旧化
- 增加留白
- 使用更统一的 3~5 色调
- 轮廓更简洁
- 文字更少、更精致

用户说“更有浮世绘感”：
- 增强边框
- 加强借景构图
- 引入花木、水面、月、云层的平面分层
- 强化深色外轮廓
- 使用木版印刷式非真实色彩

用户说“不要 AI 味”：
- 减少微小纹理
- 减少复杂细节
- 减少随机花瓣
- 减少泛光
- 减少过锐
- 避免脸部过度精细
- 强化大色块、留白、明确轮廓
- 删除随机乱码文字

用户说“更丰富一点 / 加些元素”：
- 不直接堆日式符号
- 优先从天空、地貌、植物、叙事小物中各挑 0~1 项
- 主视觉仍保持 1 个
- 辅助元素总数提升到 3~5
- 至少保留一块干净负空间

用户说“加些文字元素”：
- 默认启用主标题
- 优先再加 1 个副纸签或 1 行场景小注
- 可补 1 个小型朱印或邮戳
- 保持疏朗，不做满屏说明

用户说“更有旅行感”：
- 加强横向运动方向
- 加入远山、云层、道路 / 铁轨 / 水面倒影中的 1~2 项
- 可加入极小人物或飞鸟做尺度参照
- 文字可采用地点 / 时间 / 天气的小注格式

用户说“更有中国味”：
- 使用中国建筑、石桥、牌楼、松梅竹、云山、朱墙、青瓦等语汇
- 保留木版画的平面色块与轮廓
- 题签可改为朱红竖签、篆印或小纸签
- 不强制加入日式建筑元素

---

## 15. 最终检查

生成前检查：

- [ ] 是否只有一个清晰主视觉
- [ ] 是否为平面木版画，而不是摄影 / 3D
- [ ] 是否有明确深色外轮廓
- [ ] 是否使用低饱和色板
- [ ] 是否保留米白和纸感
- [ ] 是否存在合理留白
- [ ] 是否使用框景或版画边框
- [ ] 辅助元素是否与题材、季节、地点匹配
- [ ] 如果使用参考图，是否保留了原构图与关键识别点
- [ ] 中国 / 日本 / 欧洲 / 现代题材的文化身份是否被正确保留
- [ ] 天空、云层、倒影是否已经木版画化，而不是照片滤镜感
- [ ] 文字元素是否有主次，而不是堆字
- [ ] 是否避免随机乱码文字
- [ ] 是否没有重颗粒、重噪点和脏纹理
- [ ] 是否没有过度复杂的景深与电影光效
- [ ] 是否没有把所有元素一次性塞满

---

## 16. Skill 调用原则

当用户直接给出作品、人物、游戏、历史事件或场景名称时：

1. 不要求用户自己写 prompt。
2. 自动寻找最适合的“浮世绘化视觉符号”。
3. 不强制把角色改成日本人。
4. 原作关键轮廓、服饰、武器、建筑识别点必须保留。
5. 只转换视觉语言，不篡改主体身份。
6. 题签、边框、花木、文字元素都只服务于主体。
7. 若题材与樱花不匹配，自动换成雪、雨、枯枝、芦苇、云、火星、水波、山雾等。
8. 除非用户明确要求，否则不在图中生成长段文字。
9. 若用户要求“去掉示例”，Skill 本体不再保留长篇示例块。

---

## 17. 一句话风格核心

> **低饱和木版画色块 + 清晰深色轮廓 + 米白和纸 + 框景留白 + 克制文字元素 + 非写实平面构图。**

---

## 18. v1.2 更新点

- 去掉整段示例区块，结构更干净
- 新增完整“文字元素系统”
- 新增主标题 / 副纸签 / 场景小注 / 朱印 / 邮戳规则
- 新增文字元素默认触发逻辑与数量控制
- 强化“参考图改写 + 成品感版式”思路
- 修正自动流程中的模板引用与文字添加步骤
