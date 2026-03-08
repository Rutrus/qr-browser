import init, { decode_qr_from_rgba, generate_qr_svg } from "./pkg/qr_browser.js";

const textInputEl = document.getElementById("textInput");
const generateBtnEl = document.getElementById("generateBtn");
const qrOutputEl = document.getElementById("qrOutput");
const fileInputEl = document.getElementById("fileInput");
const dropZoneEl = document.getElementById("dropZone");
const decodeResultEl = document.getElementById("decodeResult");
const previewImageEl = document.getElementById("previewImage");
const previewMetaEl = document.getElementById("previewMeta");
let previewUrl = null;

async function bootstrap() {
  await init();
  console.info("[qr-browser] WASM initialized");
  generateBtnEl.disabled = false;
  wireEvents();
}

function wireEvents() {
  generateBtnEl.addEventListener("click", handleGenerateClick);
  textInputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      handleGenerateClick();
    }
  });
  fileInputEl.addEventListener("change", handleFileInputChange);
  document.addEventListener("paste", handlePasteImage);

  dropZoneEl.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZoneEl.classList.add("active");
  });
  dropZoneEl.addEventListener("dragleave", () => dropZoneEl.classList.remove("active"));
  dropZoneEl.addEventListener("drop", async (event) => {
    event.preventDefault();
    dropZoneEl.classList.remove("active");
    const file = event.dataTransfer?.files?.[0];
    if (file) await decodeFromFile(file);
  });
}

function handleGenerateClick() {
  const text = textInputEl.value;
  try {
    const svg = generate_qr_svg(text);
    qrOutputEl.innerHTML = svg;
    console.info("[qr-browser] QR generated");
  } catch (error) {
    qrOutputEl.textContent = "";
    console.error("[qr-browser] QR generation failed", error);
  }
}

async function handleFileInputChange(event) {
  const file = event.target.files?.[0];
  if (file) {
    await decodeFromFile(file);
  }
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

    if (!ctx) {
      throw new Error("Could not create 2D context.");
    }

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

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 1024) {
    return `${bytes || 0} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

bootstrap().catch((error) => {
  generateBtnEl.disabled = true;
  console.error("[qr-browser] WASM initialization failed", error);
});
