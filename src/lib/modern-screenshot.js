(function (global) {
'use strict';

function changeJpegDpi(uint8Array, dpi) {
  uint8Array[13] = 1;
  uint8Array[14] = dpi >> 8;
  uint8Array[15] = dpi & 255;
  uint8Array[16] = dpi >> 8;
  uint8Array[17] = dpi & 255;
  return uint8Array;
}

const _P = "p".charCodeAt(0);
const _H = "H".charCodeAt(0);
const _Y = "Y".charCodeAt(0);
const _S = "s".charCodeAt(0);
let pngDataTable;
function createPngDataTable() {
  const crcTable = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    }
    crcTable[n] = c;
  }
  return crcTable;
}
function calcCrc(uint8Array) {
  let c = -1;
  if (!pngDataTable)
    pngDataTable = createPngDataTable();
  for (let n = 0, len = uint8Array.length; n < len; n++) {
    c = pngDataTable[(c ^ uint8Array[n]) & 255] ^ (c >>> 8);
  }
  return (c ^ -1) >>> 0;
}
function createPngChunk(type, data) {
  const length = data.length;
  const uint8Array = new Uint8Array(length + 12);
  uint8Array[0] = length >>> 24;
  uint8Array[1] = length >>> 16;
  uint8Array[2] = length >>> 8;
  uint8Array[3] = length & 255;
  uint8Array[4] = type.charCodeAt(0);
  uint8Array[5] = type.charCodeAt(1);
  uint8Array[6] = type.charCodeAt(2);
  uint8Array[7] = type.charCodeAt(3);
  uint8Array.set(data, 8);
  const crc = calcCrc(uint8Array.subarray(4, length + 8));
  uint8Array[length + 8] = crc >>> 24;
  uint8Array[length + 9] = crc >>> 16;
  uint8Array[length + 10] = crc >>> 8;
  uint8Array[length + 11] = crc & 255;
  return uint8Array;
}
function createPng(width, height, rgba) {
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = new Uint8Array(13);
  ihdr[0] = width >>> 24;
  ihdr[1] = width >>> 16;
  ihdr[2] = width >>> 8;
  ihdr[3] = width & 255;
  ihdr[4] = height >>> 24;
  ihdr[5] = height >>> 16;
  ihdr[6] = height >>> 8;
  ihdr[7] = height & 255;
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const rawData = new Uint8Array(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    rawData[y * (width * 4 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const rgbaIdx = idx * 4;
      const rawIdx = y * (width * 4 + 1) + x * 4 + 1;
      rawData[rawIdx] = rgba[rgbaIdx];
      rawData[rawIdx + 1] = rgba[rgbaIdx + 1];
      rawData[rawIdx + 2] = rgba[rgbaIdx + 2];
      rawData[rawIdx + 3] = rgba[rgbaIdx + 3];
    }
  }
  const rawChunks = [];
  for (let y = 0; y < height; y++) {
    const rawDataChunk = rawData.subarray(y * (width * 4 + 1), (y + 1) * (width * 4 + 1));
    const deflated = deflateRaw(rawDataChunk);
    rawChunks.push(deflated);
  }
  const idatLength = rawChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const idat = new Uint8Array(idatLength);
  let offset = 0;
  for (const rawChunk of rawChunks) {
    idat.set(rawChunk, offset);
    offset += rawChunk.length;
  }
  const ihdrChunk = createPngChunk("IHDR", ihdr);
  const idatChunk = createPngChunk("IDAT", idat);
  const iendChunk = createPngChunk("IEND", new Uint8Array(0));
  const result = new Uint8Array(signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length);
  result.set(signature, 0);
  result.set(ihdrChunk, signature.length);
  result.set(idatChunk, signature.length + ihdrChunk.length);
  result.set(iendChunk, signature.length + ihdrChunk.length + idatChunk.length);
  return result;
}
const c = new Uint8Array(256);
const d = new Uint16Array(512);
function deflateInit() {
  for (let i = 0; i < 256; i++) {
    let j = i;
    let k = 0;
    for (let m = 0; m < 8; m++) {
      k = k << 1 | j & 1;
      j >>= 1;
    }
    c[i] = k;
  }
  for (let i = 0; i < 256; i++) {
    d[i] = (i < 128 ? 1 << 8 : 0) + c[i];
    d[i + 256] = (i >= 128 ? 1 << 8 : 0) + c[i];
  }
}
function deflateRaw(data) {
  if (c[1] === 0)
    deflateInit();
  const blocks = [];
  for (let offset = 0; offset < data.length; offset += 65535) {
    const block = data.subarray(offset, Math.min(offset + 65535, data.length));
    const isLast = offset + block.length >= data.length;
    const header = new Uint8Array([isLast ? 1 : 0, block.length & 255, block.length >>> 8, (~block.length) & 255, ((~block.length) >>> 8) & 255]);
    blocks.push(header);
    blocks.push(block);
  }
  const result = new Uint8Array([0x78, 0x01, ...blocks.flatMap((b) => Array.from(b))]);
  let a = 1;
  let b = 0;
  for (let i = 0; i < result.length; i++) {
    a = (a + result[i]) % 65521;
    b = (b + a) % 65521;
  }
  const crc = new Uint8Array([(b << 8) | a, b >> 8, (a << 8) | b, a >> 8]);
  return new Uint8Array([...result, ...crc]);
}

const hasCrypto = typeof crypto !== "undefined";
function uuid() {
  if (hasCrypto && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c2) {
    const r = Math.random() * 16 | 0;
    const v = c2 === "x" ? r : r & 0x3 | 0x8;
    return v.toString(16);
  }).replace(/-/g, "");
}

const IN_CHROME = typeof chrome !== "undefined" && !!chrome.runtime?.id;
const IN_FIREFOX = typeof browser !== "undefined" && !!browser.runtime?.id;

function isElementNode(node) {
  return node.nodeType === Node.ELEMENT_NODE;
}
function isDocumentNode(node) {
  return node.nodeType === Node.DOCUMENT_NODE;
}
function isDocumentFragmentNode(node) {
  return node.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function isTextNode(node) {
  return node.nodeType === Node.TEXT_NODE;
}
function isStyleElement(node) {
  return isElementNode(node) && node.tagName === "STYLE";
}
function isScriptElement(node) {
  return isElementNode(node) && node.tagName === "SCRIPT";
}
function isLinkElement(node) {
  return isElementNode(node) && node.tagName === "LINK";
}
function isCanvasElement(node) {
  return isElementNode(node) && node.tagName === "CANVAS";
}
function isVideoElement(node) {
  return isElementNode(node) && node.tagName === "VIDEO";
}
function isImageElement(node) {
  return isElementNode(node) && node.tagName === "IMG";
}
function isSvgElement(node) {
  return isElementNode(node) && node.tagName === "SVG";
}
function isForeignObjectElement(node) {
  return isElementNode(node) && node.tagName === "FOREIGNOBJECT";
}
function isInputElement(node) {
  return isElementNode(node) && node.tagName === "INPUT";
}
function isTextareaElement(node) {
  return isElementNode(node) && node.tagName === "TEXTAREA";
}
function isSelectElement(node) {
  return isElementNode(node) && node.tagName === "SELECT";
}
function isOptionElement(node) {
  return isElementNode(node) && node.tagName === "OPTION";
}

function getNodeScroll(node, ownerWindow) {
  const isWindow = node === ownerWindow;
  const scrollLeft = isWindow ? node.scrollX : node.scrollLeft;
  const scrollTop = isWindow ? node.scrollY : node.scrollTop;
  return { scrollLeft, scrollTop };
}
function setNodeScroll(node, ownerWindow, scrollLeft, scrollTop) {
  const isWindow = node === ownerWindow;
  if (isWindow) {
    node.scrollTo(scrollLeft, scrollTop);
  } else {
    node.scrollLeft = scrollLeft;
    node.scrollTop = scrollTop;
  }
}

function cloneAttributes(node, cloned) {
  const attributes = node.attributes;
  for (let i = 0; i < attributes.length; i++) {
    const attr = attributes[i];
    if (attr.name === "style" || attr.name === "class")
      continue;
    try {
      cloned.setAttribute(attr.name, attr.value);
    } catch (err) {
    }
  }
}

function setAttributes(node, attributes) {
  for (const [name, value] of attributes) {
    try {
      node.setAttribute(name, value);
    } catch (err) {
    }
  }
}

function clearShadowRoots(context) {
  for (const shadowRoot of context.shadowRoots) {
    try {
      shadowRoot.host.attachShadow({ mode: "open" });
    } catch (err) {
    }
  }
  context.shadowRoots = [];
}

function blobToDataUrl(blob, type) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function createImage(url, ownerDocument) {
  const image = ownerDocument.createElement("img");
  image.src = url;
  image.decoding = "sync";
  image.crossOrigin = "anonymous";
  return image;
}

function waitUntilLoad(ownerWindow, node) {
  return new Promise((resolve) => {
    const elements = node.querySelectorAll("img, svg image, video, iframe");
    const loaded = new Set();
    const check = () => {
      if (loaded.size === elements.length) {
        resolve();
        return;
      }
    };
    if (elements.length === 0) {
      resolve();
      return;
    }
    for (const element of elements) {
      if (element.complete) {
        loaded.add(element);
        check();
        continue;
      }
      const onLoad = () => {
        loaded.add(element);
        check();
      };
      const onError = () => {
        loaded.add(element);
        check();
      };
      element.addEventListener("load", onLoad, { once: true });
      element.addEventListener("error", onError, { once: true });
    }
  });
}

function loadMedia(options) {
  return new Promise((resolve, reject) => {
    const { url, type = "image", timeout = 30000 } = options;
    const timer = setTimeout(() => reject(new Error("Timeout")), timeout);
    const media = document.createElement(type);
    media.crossOrigin = "anonymous";
    media.onload = () => {
      clearTimeout(timer);
      resolve(media);
    };
    media.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Failed to load media"));
    };
    media.src = url;
  });
}

const defaultFontCssTexts = [
  "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@100;300;400;500;700;900&display=swap",
  "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@100;300;400;500;700;900&display=swap",
  "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@100;300;400;500;700;900&display=swap"
];

function createSandbox(ownerDocument) {
  const sandbox = ownerDocument.createElement("iframe");
  sandbox.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;overflow:hidden;";
  sandbox.sandbox = "allow-scripts";
  return new Promise((resolve, reject) => {
    sandbox.onload = () => {
      resolve(sandbox);
    };
    sandbox.onerror = reject;
    ownerDocument.body.appendChild(sandbox);
  });
}

function createContext(node, options) {
  const ownerDocument = node.ownerDocument || node;
  const ownerWindow = ownerDocument.defaultView;
  const {
    backgroundColor = "#ffffff",
    scale = 2,
    type = "image/png",
    quality = 0.92,
    fonts = [],
    timeout = 30000,
    onCloneNode = void 0,
    onCloneEachNode = void 0,
    fetchFn = void 0,
    fetch = {
      requestInit: {},
      bypassingCache: false,
      placeholderImage: void 0
    },
    font: fontOptions = {
      useGoogleFonts: true,
      custom: []
    },
    copyScrollbar = false,
    includeStyleProperties = void 0,
    excludeElements = void 0,
    logging = false,
    waitUntilLoad: waitUntilLoadOption = false,
    shadowRoot = true,
    workers: workersOption = [],
    requestIdleCallback: requestIdleCallbackOption = false,
    maxDimension = 4096
  } = options || {};
  const computedStyle = ownerWindow.getComputedStyle(node);
  const width = parseFloat(computedStyle.width);
  const height = parseFloat(computedStyle.height);
  const context = {
    ownerDocument,
    ownerWindow,
    node,
    width,
    height,
    scale,
    type,
    quality,
    backgroundColor,
    fonts: [...fonts],
    fontCssTexts: /* @__PURE__ */ new Set(),
    fontFamilies: /* @__PURE__ */ new Map(),
    timeout,
    onCloneNode,
    onCloneEachNode,
    fetchFn,
    fetch,
    font: fontOptions,
    copyScrollbar,
    includeStyleProperties,
    excludeElements,
    logging,
    waitUntilLoad: waitUntilLoadOption,
    shadowRoot,
    workers: [...workersOption],
    requestIdleCallback: requestIdleCallbackOption,
    maxDimension,
    svgStyleElement: void 0,
    svgDefsElement: void 0,
    svgStyles: /* @__PURE__ */ new Map(),
    defaultComputedStyles: /* @__PURE__ */ new Map(),
    requests: /* @__PURE__ */ new Map(),
    tasks: [],
    shadowRoots: [],
    log: {
      debug: (...args) => {
        if (logging)
          console.debug(...args);
      },
      warn: (...args) => {
        if (logging)
          console.warn(...args);
      },
      error: (...args) => {
        if (logging)
          console.error(...args);
      }
    }
  };
  if (fontOptions.useGoogleFonts) {
    defaultFontCssTexts.forEach((cssText) => context.fontCssTexts.add(cssText));
  }
  if (fontOptions.custom) {
    fontOptions.custom.forEach((cssText) => context.fontCssTexts.add(cssText));
  }
  return context;
}

function destroyContext(context) {
  context.ownerDocument = void 0;
  context.ownerWindow = void 0;
  context.svgStyleElement = void 0;
  context.svgDefsElement = void 0;
  context.svgStyles.clear();
  context.defaultComputedStyles.clear();
  if (context.sandbox) {
    try {
      context.sandbox.remove();
    } catch (err) {
      context.log.warn("Failed to destroyContext", err);
    }
    context.sandbox = void 0;
  }
  context.workers = [];
  context.fontFamilies.clear();
  context.fontCssTexts.clear();
  context.requests.clear();
  context.tasks = [];
  context.shadowRoots = [];
}

function baseFetch(options) {
  const { url, timeout, responseType, ...requestInit } = options;
  const controller = new AbortController();
  const timer = timeout ? setTimeout(() => controller.abort(), timeout) : void 0;
  return fetch(url, { signal: controller.signal, ...requestInit }).then((response) => {
    if (!response.ok) {
      throw new Error("Failed fetch, not 2xx response", { cause: response });
    }
    switch (responseType) {
      case "arrayBuffer":
        return response.arrayBuffer();
      case "dataUrl":
        return response.blob().then(blobToDataUrl);
      case "text":
      default:
        return response.text();
    }
  }).finally(() => clearTimeout(timer));
}
function contextFetch(context, options) {
  const { url: rawUrl, requestType = "text", responseType = "text", imageDom } = options;
  let url = rawUrl;
  const {
    timeout,
    acceptOfImage,
    requests,
    fetchFn,
    fetch: {
      requestInit,
      bypassingCache,
      placeholderImage
    },
    font,
    workers,
    ownerDocument,
    log
  } = context;
  if (!url)
    return Promise.resolve("");
  if (bypassingCache) {
    url = url + (url.includes("?") ? "&" : "?") + "_t=" + Date.now();
  }
  const requestKey = `${url}_${responseType}`;
  if (requests.has(requestKey)) {
    return requests.get(requestKey);
  }
  const promise = (async () => {
    try {
      const effectiveFetch = fetchFn || baseFetch;
      const headers = {
        ...requestInit.headers,
        Accept: requestType === "font" ? "font/*" : requestType === "image" ? acceptOfImage || "image/avif,image/webp,image/png,image/svg+xml,image/*,*/*;q=0.8" : "*/*"
      };
      const result = await effectiveFetch({
        url,
        timeout,
        responseType,
        ...requestInit,
        headers
      });
      return result;
    } catch (err) {
      log.warn("Failed to fetch", url, err);
      if (requestType === "image" && placeholderImage) {
        return placeholderImage;
      }
      if (requestType === "image" && imageDom) {
        try {
          const canvas = ownerDocument.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.width = 1;
          canvas.height = 1;
          ctx.fillStyle = "#cccccc";
          ctx.fillRect(0, 0, 1, 1);
          return canvas.toDataURL("image/png");
        } catch (err2) {
        }
      }
      return "";
    }
  })();
  requests.set(requestKey, promise);
  return promise;
}

function getDefaultStyle(node, pseudoElement, context) {
  const { defaultComputedStyles, ownerWindow } = context;
  const tagName = node.tagName;
  const key = `${tagName}_${pseudoElement || ""}`;
  let defaultStyle = defaultComputedStyles.get(key);
  if (!defaultStyle) {
    const dummy = ownerWindow.document.createElement(tagName);
    dummy.style.cssText = "position:absolute;visibility:hidden;display:block;";
    ownerWindow.document.body.appendChild(dummy);
    defaultStyle = new Map();
    const computedStyle = ownerWindow.getComputedStyle(dummy, pseudoElement);
    for (let i = 0; i < computedStyle.length; i++) {
      const name = computedStyle[i];
      const value = computedStyle.getPropertyValue(name);
      const priority = computedStyle.getPropertyPriority(name);
      defaultStyle.set(name, [value, priority]);
    }
    defaultComputedStyles.set(key, defaultStyle);
    try {
      dummy.remove();
    } catch (err) {
    }
  }
  return defaultStyle;
}

function getDiffStyle(computedStyle, defaultStyle, includeStyleProperties) {
  const diffStyle = new Map();
  for (let i = 0; i < computedStyle.length; i++) {
    const name = computedStyle[i];
    if (includeStyleProperties && !includeStyleProperties.includes(name))
      continue;
    const value = computedStyle.getPropertyValue(name);
    const priority = computedStyle.getPropertyPriority(name);
    const defaultValue = defaultStyle.get(name);
    if (!defaultValue || defaultValue[0] !== value || defaultValue[1] !== priority) {
      diffStyle.set(name, [value, priority]);
    }
  }
  return diffStyle;
}

function splitFontFamily(fontFamily) {
  if (!fontFamily)
    return [];
  const families = fontFamily.split(",");
  return families.map((family) => family.trim().replace(/['"]/g, "")).filter((family) => family && family !== "inherit" && family !== "initial" && family !== "unset");
}

function copyStyle(node, cloned, context, addWordToFontFamilies) {
  const { ownerWindow, svgStyleElement, svgStyles, currentNodeStyle, includeStyleProperties } = context;
  if (!svgStyleElement)
    return;
  const pseudoElement = void 0;
  const defaultStyle = getDefaultStyle(node, pseudoElement, context);
  currentNodeStyle?.forEach((_, key) => {
    defaultStyle.delete(key);
  });
  const style = getDiffStyle(ownerWindow.getComputedStyle(node, pseudoElement), defaultStyle, includeStyleProperties);
  if (style.get("background-clip")?.[0] === "text") {
    cloned.classList.add("______background-clip--text");
  }
  style.delete("margin");
  style.delete("margin-top");
  style.delete("margin-right");
  style.delete("margin-bottom");
  style.delete("margin-left");
  style.delete("margin-block-start");
  style.delete("margin-block-end");
  style.delete("margin-inline-start");
  style.delete("margin-inline-end");
  style.set("box-sizing", ["border-box", ""]);
  if (style.get("background-clip")?.[0] === "text") {
    cloned.classList.add("______background-clip--text");
  }
  if (IN_CHROME) {
    if (!style.has("font-kerning"))
      style.set("font-kerning", ["normal", ""]);
    if ((style.get("overflow-x")?.[0] === "hidden" || style.get("overflow-y")?.[0] === "hidden") && style.get("text-overflow")?.[0] === "ellipsis" && node.scrollWidth === node.clientWidth) {
      style.set("text-overflow", ["clip", ""]);
    }
  }
  const clonedStyle = cloned.style;
  for (let len = clonedStyle.length, i = 0; i < len; i++) {
    clonedStyle.removeProperty(clonedStyle.item(i));
  }
  style.forEach(([value, priority], name) => {
    clonedStyle.setProperty(name, value, priority);
  });
  return style;
}

function copyInputValue(node, cloned) {
  if (isTextareaElement(node) || isInputElement(node) || isSelectElement(node)) {
    cloned.setAttribute("value", node.value);
  }
}

const pseudoClasses = [
  "::before",
  "::after"
];
const scrollbarPseudoClasses = [
  "::-webkit-scrollbar",
  "::-webkit-scrollbar-button",
  "::-webkit-scrollbar-thumb",
  "::-webkit-scrollbar-track",
  "::-webkit-scrollbar-track-piece",
  "::-webkit-scrollbar-corner",
  "::-webkit-resizer"
];
function copyPseudoClass(node, cloned, copyScrollbar, context, addWordToFontFamilies) {
  const { ownerWindow, svgStyleElement, svgStyles, currentNodeStyle } = context;
  if (!svgStyleElement || !ownerWindow)
    return;
  function copyBy(pseudoClass) {
    const computedStyle = ownerWindow.getComputedStyle(node, pseudoClass);
    let content = computedStyle.getPropertyValue("content");
    if (!content || content === "none")
      return;
    addWordToFontFamilies?.(content);
    content = content.replace(/(')|(")|(counter\(.+\))/g, "");
    const klasses = [uuid()];
    const defaultStyle = getDefaultStyle(node, pseudoClass, context);
    currentNodeStyle?.forEach((_, key) => {
      defaultStyle.delete(key);
    });
    const style = getDiffStyle(computedStyle, defaultStyle, context.includeStyleProperties);
    style.delete("content");
    style.delete("-webkit-locale");
    if (style.get("background-clip")?.[0] === "text") {
      cloned.classList.add("______background-clip--text");
    }
    const cloneStyle = [
      `content: '${content}';`
    ];
    style.forEach(([value, priority], name) => {
      cloneStyle.push(`${name}: ${value}${priority ? " !important" : ""};`);
    });
    if (cloneStyle.length === 1)
      return;
    try {
      cloned.className = [cloned.className, ...klasses].join(" ");
    } catch (err) {
      context.log.warn("Failed to copyPseudoClass", err);
      return;
    }
    const cssText = cloneStyle.join("\n  ");
    let allClasses = svgStyles.get(cssText);
    if (!allClasses) {
      allClasses = [];
      svgStyles.set(cssText, allClasses);
    }
    allClasses.push(`.${klasses[0]}${pseudoClass}`);
  }
  pseudoClasses.forEach(copyBy);
  if (copyScrollbar)
    scrollbarPseudoClasses.forEach(copyBy);
}

const excludeParentNodes = /* @__PURE__ */ new Set([
  "symbol"
]);
async function appendChildNode(node, cloned, child, context, addWordToFontFamilies) {
  if (isElementNode(child) && (isStyleElement(child) || isScriptElement(child)))
    return;
  if (context.excludeElements && context.excludeElements(child))
    return;
  const clonedChild = await cloneNode(child, context, addWordToFontFamilies);
  if (clonedChild) {
    cloned.appendChild(clonedChild);
  }
}

async function cloneChildNodes(node, cloned, context, addWordToFontFamilies) {
  const { shadowRoot: shadowRootOption, shadowRoots } = context;
  for (const child of node.childNodes) {
    await appendChildNode(node, cloned, child, context, addWordToFontFamilies);
  }
  if (shadowRootOption && node.shadowRoot) {
    const clonedShadowRoot = cloned.attachShadow({ mode: "open" });
    shadowRoots.push(clonedShadowRoot);
    for (const child of node.shadowRoot.childNodes) {
      await appendChildNode(node.shadowRoot, clonedShadowRoot, child, context, addWordToFontFamilies);
    }
  }
}

async function cloneNode(node, context, addWordToFontFamilies) {
  const { onCloneNode, log } = context;
  let cloned;
  if (isDocumentNode(node)) {
    cloned = node.implementation.createHTMLDocument();
    cloned.documentElement.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  } else if (isDocumentFragmentNode(node)) {
    cloned = node.ownerDocument.createDocumentFragment();
  } else if (isTextNode(node)) {
    cloned = node.cloneNode(true);
  } else if (isElementNode(node)) {
    if (isCanvasElement(node)) {
      try {
        cloned = node.cloneNode(false);
        const ctx = cloned.getContext("2d");
        ctx.drawImage(node, 0, 0);
      } catch (err) {
        log.warn("Failed to clone canvas", err);
        cloned = node.cloneNode(false);
      }
    } else if (isVideoElement(node)) {
      const canvas = node.ownerDocument.createElement("canvas");
      canvas.width = node.videoWidth || node.width;
      canvas.height = node.videoHeight || node.height;
      const ctx = canvas.getContext("2d");
      try {
        ctx.drawImage(node, 0, 0);
      } catch (err) {
        log.warn("Failed to clone video", err);
      }
      cloned = canvas;
    } else {
      cloned = node.cloneNode(false);
    }
    if (onCloneNode) {
      const result = onCloneNode(node, cloned);
      if (result === false)
        return null;
      if (result instanceof HTMLElement)
        cloned = result;
    }
    if (isElementNode(cloned)) {
      cloneAttributes(node, cloned);
      const style = copyStyle(node, cloned, context, addWordToFontFamilies);
      const textTransform = style?.get("text-transform")?.[0];
      const families = style ? splitFontFamily(style.get("font-family")?.[0]) : [];
      const addWordToFontFamilies2 = families.length ? (word) => {
        if (textTransform === "uppercase") {
          word = word.toUpperCase();
        } else if (textTransform === "lowercase") {
          word = word.toLowerCase();
        } else if (textTransform === "capitalize") {
          word = word[0].toUpperCase() + word.substring(1);
        }
        families.forEach((family) => {
          let fontFamily = context.fontFamilies.get(family);
          if (!fontFamily) {
            context.fontFamilies.set(family, fontFamily = /* @__PURE__ */ new Set());
          }
          word.split("").forEach((text) => fontFamily.add(text));
        });
      } : void 0;
      copyPseudoClass(
        node,
        cloned,
        context.copyScrollbar,
        context,
        addWordToFontFamilies2
      );
      copyInputValue(node, cloned);
      if (!isVideoElement(node)) {
        await cloneChildNodes(
          node,
          cloned,
          context,
          addWordToFontFamilies2
        );
      }
      if (context.onCloneEachNode) {
        await context.onCloneEachNode(cloned);
      }
    }
  }
  return cloned;
}

async function injectFonts(context) {
  const { fontFamilies, fontCssTexts, ownerDocument } = context;
  if (fontFamilies.size === 0)
    return;
  const styleElement = ownerDocument.createElement("style");
  let cssText = "";
  for (const [family, chars] of fontFamilies) {
    if (chars.size === 0)
      continue;
    cssText += `@font-face {
  font-family: '${family}';
  src: local('${family}');
  unicode-range: ${Array.from(chars).map((char) => {
      const code = char.charCodeAt(0);
      return `U+${code.toString(16).toUpperCase().padStart(4, "0")}`;
    }).join(",")};
}`;
  }
  for (const fontCssText of fontCssTexts) {
    try {
      const response = await fetch(fontCssText);
      const text = await response.text();
      cssText += text;
    } catch (err) {
      context.log.warn("Failed to inject font", fontCssText, err);
    }
  }
  styleElement.textContent = cssText;
  ownerDocument.head.appendChild(styleElement);
}

async function createSvg(context) {
  const { node, width, height, backgroundColor, ownerDocument } = context;
  const svg = ownerDocument.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", width.toString());
  svg.setAttribute("height", height.toString());
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  if (backgroundColor) {
    const rect = ownerDocument.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("width", "100%");
    rect.setAttribute("height", "100%");
    rect.setAttribute("fill", backgroundColor);
    svg.appendChild(rect);
  }
  const defs = ownerDocument.createElementNS("http://www.w3.org/2000/svg", "defs");
  const style = ownerDocument.createElementNS("http://www.w3.org/2000/svg", "style");
  context.svgStyleElement = style;
  context.svgDefsElement = defs;
  defs.appendChild(style);
  svg.appendChild(defs);
  const foreignObject = ownerDocument.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
  foreignObject.setAttribute("width", "100%");
  foreignObject.setAttribute("height", "100%");
  foreignObject.setAttribute("x", "0");
  foreignObject.setAttribute("y", "0");
  foreignObject.setAttribute("requiredFeatures", "http://www.w3.org/TR/SVG11/feature#Extensibility");
  svg.appendChild(foreignObject);
  const cloned = await cloneNode(node, context);
  if (cloned) {
    foreignObject.appendChild(cloned);
  }
  if (context.fontFamilies.size > 0) {
    await injectFonts(context);
  }
  return svg;
}

async function domToSvg(context) {
  const svg = await createSvg(context);
  return new XMLSerializer().serializeToString(svg);
}

async function domToDataUrl(context) {
  const { type, quality, width, height, scale, maxDimension, ownerDocument } = context;
  const svg = await createSvg(context);
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
  const image = createImage(svgUrl, ownerDocument);
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
  });
  const canvasWidth = Math.min(width * scale, maxDimension);
  const canvasHeight = Math.min(height * scale, maxDimension);
  const canvas = ownerDocument.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");
  ctx.scale(canvasWidth / width, canvasHeight / height);
  ctx.drawImage(image, 0, 0);
  if (type === "image/jpeg") {
    const dataUrl = canvas.toDataURL(type, quality);
    const uint8Array = new Uint8Array(atob(dataUrl.split(",")[1]).split("").map((c2) => c2.charCodeAt(0)));
    changeJpegDpi(uint8Array, Math.round(scale * 96));
    return `data:image/jpeg;base64,${btoa(String.fromCharCode(...uint8Array))}`;
  }
  return canvas.toDataURL(type, quality);
}

async function domToCanvas(context) {
  const { width, height, scale, maxDimension, ownerDocument } = context;
  const svg = await createSvg(context);
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
  const image = createImage(svgUrl, ownerDocument);
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
  });
  const canvasWidth = Math.min(width * scale, maxDimension);
  const canvasHeight = Math.min(height * scale, maxDimension);
  const canvas = ownerDocument.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");
  ctx.scale(canvasWidth / width, canvasHeight / height);
  ctx.drawImage(image, 0, 0);
  return canvas;
}

async function domToBlob(context) {
  const { type, quality } = context;
  const canvas = await domToCanvas(context);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

async function orCreateContext(node, options) {
  const context = createContext(node, options);
  try {
    if (context.waitUntilLoad) {
      await waitUntilLoad(context.ownerWindow, node);
    }
    return context;
  } catch (err) {
    destroyContext(context);
    throw err;
  }
}

async function toCanvas(node, options) {
  const context = await orCreateContext(node, options);
  try {
    return await domToCanvas(context);
  } finally {
    destroyContext(context);
  }
}

async function toDataUrl(node, options) {
  const context = await orCreateContext(node, options);
  try {
    return await domToDataUrl(context);
  } finally {
    destroyContext(context);
  }
}

async function toBlob(node, options) {
  const context = await orCreateContext(node, options);
  try {
    return await domToBlob(context);
  } finally {
    destroyContext(context);
  }
}

global.modernScreenshot = {
  toCanvas,
  toDataUrl,
  toBlob,
  createContext,
  destroyContext,
  waitUntilLoad,
  loadMedia
};

})(typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : this);
