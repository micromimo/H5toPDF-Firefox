# HTML5 to PDF WebExtension (Firefox)

这是一个正处于**初步开发阶段**的 [Mozilla-Firefox](https://github.com/mozilla-firefox/firefox) 扩展插件，旨在提供一种高保真度的网页输出为 PDF 解决方案。这也太难了😭

### 核心功能
大多数网页转 PDF 工具（包括浏览器内置的“打印”功能）在处理现代 HTML5 页面时，往往会因为responsive web media queries或复杂的 CSS 布局等而导致排版错乱。

本插件**并非调用 Print 机制**，而是直接捕获页面当前的 DOM 结构进行转换。

### 特性
* **所见即所得**：直接基于捕获的 DOM 进行渲染，完美保留所有样式和带格式文本，确保输出的 PDF 与您在浏览器中看到的页面完全一致。
* **摆脱打印限制**：彻底告别传统打印机制带来的页面错位、样式丢失等问题。
* **自定义规格**：支持按指定的像素尺寸及比例输出 PDF，适应多元化的排版与存档需求。

### 开发进度
* [x] 基础 PDF 导出
* [ ] DOM 结构捕获与核心渲染逻辑
* [ ] 自定义像素与比例调整界面
* [ ] 针对React/Vue框架做特定优化
* [ ] 优化大图及长网页的内存占用

# HTML5 to PDF WebExtension (Firefox)
A [Mozilla-Firefox](https://github.com/mozilla-firefox/firefox) extension dedicated to delivering high-fidelity webpage-to-PDF conversion. (Currently in **active early development**).

### Why this extension?
Most existing webpage-to-PDF tools, including the browser's built-in print feature, often break layouts due to print media queries or complex modern CSS. 

This extension **bypasses the system's native Print mechanism** entirely. Instead, it captures the live DOM structure to generate the PDF.

### Key Features
* **What You See Is What You Get**: Renders PDFs directly from the captured DOM, preserving all styles and formatted text to ensure the output matches your browser view perfectly.
* **No Print Engine Limitations**: Completely avoids the layout shifts, missing styles, or awkward page breaks caused by traditional printer rendering.
* **Custom Dimensions**: Supports outputting PDFs with specific pixel dimensions and ratios to satisfy diverse presentation and archiving needs.

### Development Roadmap
* [x] Basic PDF export functionality
* [ ] DOM capturing & core rendering logic
* [ ] UI for custom pixel sizes and aspect ratios
* [ ] Performance optimization for React/Vue architecture
* [ ] Performance optimization for long pages
