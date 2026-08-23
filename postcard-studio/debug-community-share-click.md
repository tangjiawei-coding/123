# Debug: community-share-click

状态：[OPEN]

## 现象
“我的社区”中的“分享到社区”按钮点击后没有反应。

## 假设
1. 分享按钮选择器或作品 ID 错误。
2. 卡片重渲染后事件没有绑定。
3. 分享请求的接口路径或请求体错误。
4. 请求成功但界面没有反馈或刷新。
5. 其他元素覆盖或拦截按钮点击。

## 证据
- 捕获阶段与按钮局部监听均收到点击，排除按钮覆盖、事件未绑定和旧缓存。
- openShareWorkModal 正常执行，作品 ID、弹窗元素和确认按钮均有效。
- 添加 show 后计算样式为 display:flex、visibility:visible，但 opacity:0、尺寸 0×0。
- 弹窗遮罩复用了包含 transform:translateY 的全局 fadeIn 页面动画。

## 修复
- 弹窗改用独立 modalFadeIn 动画，仅改变透明度。
- 显式设置 opacity:1 和 transform:none，避免 fixed 遮罩受页面位移动画影响。

## 待验证
强制刷新后点击“分享到社区”，确认弹窗显示和发布流程。
