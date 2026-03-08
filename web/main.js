import init, { decode_qr_from_rgba, generate_qr_svg_advanced } from "./pkg/qr_browser.js";

const textInputEl = document.getElementById("textInput");
const generateBtnEl = document.getElementById("generateBtn");
const applyMinPresetBtnEl = document.getElementById("applyMinPresetBtn");
const qrOutputEl = document.getElementById("qrOutput");
const generateMetaEl = document.getElementById("generateMeta");
const redundancySelectEl = document.getElementById("redundancySelect");
const borderInputEl = document.getElementById("borderInput");
const formatSelectEl = document.getElementById("formatSelect");
const sizeInputEl = document.getElementById("sizeInput");
const fileInputEl = document.getElementById("fileInput");
const dropZoneEl = document.getElementById("dropZone");
const decodeResultEl = document.getElementById("decodeResult");
const previewImageEl = document.getElementById("previewImage");
const previewMetaEl = document.getElementById("previewMeta");
let previewUrl = null;
const DEFAULT_QR_SIZE = 400;
const MIN_BYTES_RECOMMENDED = {
  redundancy: "L",
  border: 1,
  outputFormat: "png",
  outputSize: 128,
};

async function bootstrap() {
  await init();
  console.info("[qr-browser] WASM initialized");
  generateBtnEl.disabled = false;
  wireEvents();
}

function wireEvents() {
  generateBtnEl.addEventListener("click", handleGenerateClick);
  applyMinPresetBtnEl.addEventListener("click", applyRecommendedInputs);
  textInputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") handleGenerateClick();
  });
  fileInputEl.addEventListener("change", handleFileInputChange);
  document.addEventListener("paste", handlePasteImage);

  dropZoneEl.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZoneEl.classList.add("active");
  });
  dropZoneEl.addEventListener("dragleave", () => dropZoneEl.classList.remove("active"));
  dropZoneEl.addEventListener("click", () => fileInputEl.click());
  dropZoneEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInputEl.click();
    }
  });
  dropZoneEl.addEventListener("drop", async (event) => {
    event.preventDefault();
    dropZoneEl.classList.remove("active");
    const file = event.dataTransfer?.files?.[0];
    if (file) await decodeFromFile(file);
  });
}

async function handleGenerateClick() {
  const text = textInputEl.value;
  try {
    qrOutputEl.textContent = "Generating...";
    generateMetaEl.textContent = "";
    const options = getGenerateOptions();
    const svg = generate_qr_svg_advanced(text, options.redundancy, options.border);

    const imageDataUrl =
      options.outputFormat === "svg"
        ? svgToDataUrl(svg)
        : await renderSvgAsPngDataUrl(svg, options.outputSize);
    const byteSize =
      options.outputFormat === "svg"
        ? new Blob([svg], { type: "image/svg+xml;charset=utf-8" }).size
        : dataUrlByteLength(imageDataUrl);

    await loadImage(imageDataUrl);
    const generatedImage = document.createElement("img");
    generatedImage.src = imageDataUrl;
    generatedImage.alt = "Generated QR code";
    generatedImage.className = "generated-qr";
    qrOutputEl.replaceChildren(generatedImage);
    generateMetaEl.textContent = `Output: ${options.outputFormat.toUpperCase()} · ${formatBytes(byteSize)} · ${options.outputSize}px`;
    console.info("[qr-browser] QR generated");
  } catch (error) {
    qrOutputEl.textContent = "Failed to render QR image.";
    generateMetaEl.textContent = String(error);
    console.error("[qr-browser] QR generation failed", error);
  }
}

async function handleFileInputChange(event) {
  const file = event.target.files?.[0];
  if (file) await decodeFromFile(file);
}

async function handlePasteImage(event) {
  const clipboardItems = event.clipboardData?.items ?? [];
  for (const item of clipboardItems) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        await decodeFromFile(file);
        return;
      }
    }
  }
}

async function decodeFromFile(file) {
  try {
    decodeResultEl.textContent = "Processing image...";
    showPreview(file);
    const imageBitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Could not create 2D context.");

    ctx.drawImage(imageBitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const decoded = decode_qr_from_rgba(canvas.width, canvas.height, imageData.data);
    decodeResultEl.textContent = decoded;
    console.info("[qr-browser] QR decoded");
  } catch (error) {
    decodeResultEl.textContent = `Error: ${String(error)}`;
    console.error("[qr-browser] QR decoding failed", error);
  }
}

function getGenerateOptions() {
  const redundancy = redundancySelectEl.value || "M";
  const parsedBorder = Number.parseInt(borderInputEl.value, 10);
  const border = Number.isFinite(parsedBorder) ? Math.min(32, Math.max(0, parsedBorder)) : 4;
  const outputFormat = formatSelectEl.value === "svg" ? "svg" : "png";
  const parsedSize = Number.parseInt(sizeInputEl.value, 10);
  const outputSize = Number.isFinite(parsedSize) ? Math.min(1024, Math.max(128, parsedSize)) : DEFAULT_QR_SIZE;
  borderInputEl.value = String(border);
  sizeInputEl.value = String(outputSize);
  return { redundancy, border, outputFormat, outputSize };
}

function applyRecommendedInputs() {
  redundancySelectEl.value = MIN_BYTES_RECOMMENDED.redundancy;
  borderInputEl.value = String(MIN_BYTES_RECOMMENDED.border);
  formatSelectEl.value = MIN_BYTES_RECOMMENDED.outputFormat;
  sizeInputEl.value = String(MIN_BYTES_RECOMMENDED.outputSize);
}

function svgToDataUrl(svgMarkup) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
}

async function renderSvgAsPngDataUrl(svgMarkup, outputSizePx) {
  const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);
  try {
    const image = await loadImage(svgUrl);
    const canvas = document.createElement("canvas");
    canvas.width = outputSizePx;
    canvas.height = outputSizePx;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create canvas context.");

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, outputSizePx, outputSizePx);
    ctx.drawImage(image, 0, 0, outputSizePx, outputSizePx);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function showPreview(file) {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
  previewUrl = URL.createObjectURL(file);
  previewImageEl.src = previewUrl;
  previewImageEl.style.display = "block";
  previewMetaEl.textContent = `${file.name || "pasted-image"} · ${formatBytes(file.size)}`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeoutMs = 5000;
    const timeoutId = setTimeout(() => {
      image.onload = null;
      image.onerror = null;
      reject(new Error("Image load timeout."));
    }, timeoutMs);
    image.onload = () => {
      clearTimeout(timeoutId);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timeoutId);
      reject(new Error("Could not load generated image."));
    };
    image.src = src;
  });
}

function dataUrlByteLength(dataUrl) {
  const marker = ";base64,";
  const markerIndex = dataUrl.indexOf(marker);
  if (markerIndex === -1) return dataUrl.length;
  const base64 = dataUrl.slice(markerIndex + marker.length);
  const paddingMatch = base64.match(/=*$/);
  const padding = paddingMatch ? paddingMatch[0].length : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 1024) return `${bytes || 0} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

bootstrap().catch((error) => {
  generateBtnEl.disabled = true;
  console.error("[qr-browser] WASM initialization failed", error);
});
