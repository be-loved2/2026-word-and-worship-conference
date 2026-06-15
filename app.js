/**
 * NEW WINE 2026 — Flyer Generator
 * ─────────────────────────────────
 * Loads the fixed flyer template as a background image.
 * Dynamically composites ONLY:
 *   1. User photo  → circular clipped mask over the gold ring
 *   2. User name   → bold text below the circle
 *
 * Template size:  1024 × 1536 (source)
 * Output canvas:  1080 × 1920 (high-res portrait)
 *
 * All coordinates below are calibrated for 1080 × 1920.
 */

'use strict';

// ── DOM REFS ──────────────────────────────────────────────────────────────
const dropZone       = document.getElementById('dropZone');
const photoInput     = document.getElementById('photoInput');
const photoPreview   = document.getElementById('photoPreview');
const previewWrap    = document.getElementById('previewWrap');
const btnChange      = document.getElementById('btnChange');
const titleSelect    = document.getElementById('titleSelect');
const nameInput      = document.getElementById('nameInput');
const namePreviewTxt = document.getElementById('namePreviewText');
const btnGenerate    = document.getElementById('btnGenerate');
const btnDownload    = document.getElementById('btnDownload');
const progressWrap   = document.getElementById('progressWrap');
const progressFill   = document.getElementById('progressFill');
const progressLabel  = document.getElementById('progressLabel');
const flyerCanvas    = document.getElementById('flyerCanvas');       // preview
const exportCanvas   = document.getElementById('exportCanvas');       // full-res export
const canvasPlaceholder = document.getElementById('canvasPlaceholder');

const previewCtx = flyerCanvas.getContext('2d');
const exportCtx  = exportCanvas.getContext('2d');

// ── STATE ─────────────────────────────────────────────────────────────────
let userPhoto   = null;   // HTMLImageElement once loaded
let flyerReady  = false;  // true after first generate
let isGenerating = false;

// ── FLYER GEOMETRY (at 1080 × 1920) ──────────────────────────────────────
// These values were measured from the 1024×1536 source image and scaled up.
// PHOTO CIRCLE — the gold ring frame
const PHOTO = {
  cx:     540,   // circle centre X
  cy:     610,   // circle centre Y  (tuned visually)
  radius: 305,   // inner radius of the ring (excluding ring border)
};

// NAME TEXT — baseline Y, horizontally centred
const NAME = {
  x:       540,   // canvas horizontal centre
  yBase:   980,   // baseline Y of the name line
  maxWidth: 850,  // max allowed text width before shrinking
  fontSize: 60,   // default font size (px)
  minSize:  28,   // never go below this
  fontFace: '"Montserrat", "Arial", san-serif',
  color:    '#111111',
  shadow:   'rgba(255,255,255,0.8)',
};

// ── TEMPLATE IMAGE ────────────────────────────────────────────────────────
const templateImg = new Image();
templateImg.src   = 'new-wine-template.png';

templateImg.onerror = () => {
  console.error('[FlyerGen] Could not load template image. Make sure assets/new-wine-template.png exists.');
};

// ── DRAG & DROP ───────────────────────────────────────────────────────────
dropZone.addEventListener('click', () => photoInput.click());
dropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') photoInput.click(); });

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) handleFile(file);
});

photoInput.addEventListener('change', () => {
  if (photoInput.files[0]) handleFile(photoInput.files[0]);
});

btnChange.addEventListener('click', () => photoInput.click());

// ── FILE HANDLER ──────────────────────────────────────────────────────────
function handleFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      userPhoto = img;

      // Show compact preview
      photoPreview.src = e.target.result;
      previewWrap.classList.remove('hidden');
      dropZone.classList.add('hidden');

      checkReady();
      // Auto-preview if name already entered
      if (nameInput.value.trim()) generateFlyer(true);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ── NAME LIVE PREVIEW ─────────────────────────────────────────────────────
nameInput.addEventListener('input', () => {
  updateNameHint();
  checkReady();
  if (userPhoto && nameInput.value.trim()) debouncePreview();
});

titleSelect.addEventListener('change', () => {
  updateNameHint();
  if (userPhoto && nameInput.value.trim()) debouncePreview();
});

function updateNameHint() {
  const full = buildFullName();
  namePreviewTxt.textContent = full ? `Preview: ${full}` : '';
}

function buildFullName() {
  const title = titleSelect.value.trim();
  const name  = nameInput.value.trim().toUpperCase();
  return name ? (title ? `${title} ${name}` : name) : '';
}

// ── DEBOUNCED AUTO-PREVIEW ────────────────────────────────────────────────
let previewTimer = null;
function debouncePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => generateFlyer(true), 600);
}

// ── ENABLE GENERATE BUTTON ────────────────────────────────────────────────
function checkReady() {
  btnGenerate.disabled = !(userPhoto && nameInput.value.trim());
}

// ── GENERATE BUTTON ───────────────────────────────────────────────────────
btnGenerate.addEventListener('click', () => {
  if (isGenerating) return;
  generateFlyer(false);
});

// ── CORE GENERATOR ───────────────────────────────────────────────────────
/**
 * @param {boolean} previewOnly – if true, draw only into the small preview canvas
 *                                without showing progress UI or enabling download
 */
async function generateFlyer(previewOnly) {
  if (!userPhoto || !nameInput.value.trim()) return;
  if (isGenerating) return;

  isGenerating = true;
  const fullName = buildFullName();

  if (!previewOnly) {
    // Show progress
    progressWrap.classList.remove('hidden');
    btnDownload.classList.add('hidden');
    btnGenerate.disabled = true;
    setProgress(5, 'Loading template…');
  }

  try {
    // Wait for template to be ready
    await ensureTemplateLoaded();

    if (!previewOnly) setProgress(30, 'Placing your photo…');

    // ── EXPORT CANVAS (1080 × 1920) ──────────────────────────
    compositeFlyer(exportCtx, exportCanvas.width, exportCanvas.height, fullName);

    if (!previewOnly) setProgress(70, 'Rendering name…');

    // ── PREVIEW CANVAS (scaled to fit display) ──────────────
    compositeFlyer(previewCtx, flyerCanvas.width, flyerCanvas.height, fullName);

    // Hide placeholder
    canvasPlaceholder.classList.add('hidden');

    if (!previewOnly) {
      setProgress(100, 'Done!');
      setTimeout(() => {
        progressWrap.classList.add('hidden');
        btnDownload.classList.remove('hidden');
        btnGenerate.disabled = false;
        flyerReady = true;
      }, 600);
    }

  } catch (err) {
    console.error('[FlyerGen] Error:', err);
    if (!previewOnly) {
      setProgress(0, 'Something went wrong. Please try again.');
      btnGenerate.disabled = false;
    }
  } finally {
    isGenerating = false;
  }
}

// ── COMPOSITE ONTO A GIVEN CONTEXT ───────────────────────────────────────
/**
 * Draws the complete flyer onto `ctx`.
 * Works at any canvas size — all coordinates are proportional.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} W  canvas width
 * @param {number} H  canvas height
 * @param {string} fullName
 */
function compositeFlyer(ctx, W, H, fullName) {
  // Scale factors from the 1080×1920 reference
  const sx = W / 1080;
  const sy = H / 1920;

  // 1. Draw the template image stretched to fill the canvas
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(templateImg, 0, 0, W, H);

  // 2. Draw user photo clipped to the circle
  drawCirclePhoto(ctx, W, H, sx, sy);

  // 3. Draw the name
  drawName(ctx, W, H, sx, sy, fullName);
}

// ── DRAW CIRCULAR PHOTO ───────────────────────────────────────────────────
function drawCirclePhoto(ctx, W, H, sx, sy) {
  const cx     = PHOTO.cx * sx;
  const cy     = PHOTO.cy * sy;
  const radius = PHOTO.radius * Math.min(sx, sy);

  // Calculate cover-fit dimensions (object-fit: cover)
  const diameter = radius * 2;
  const imgW = userPhoto.naturalWidth;
  const imgH = userPhoto.naturalHeight;

  const scale = Math.max(diameter / imgW, diameter / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  const drawX = cx - drawW / 2;
  const drawY = cy - drawH / 2;

  ctx.save();

  // Clip to circle
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();

  // Draw image centred and cover-fitted
  ctx.drawImage(userPhoto, drawX, drawY, drawW, drawH);

  ctx.restore();
}

// ── DRAW NAME ─────────────────────────────────────────────────────────────
function drawName(ctx, W, H, sx, sy, fullName) {
  const x       = NAME.x * sx;
  const yBase   = NAME.yBase * sy;
  const maxW    = NAME.maxWidth * sx;

  // Auto-scale font to fit within maxW
  let fontSize  = NAME.fontSize * Math.min(sx, sy);
  const minSize = NAME.minSize  * Math.min(sx, sy);

  ctx.save();
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'alphabetic';

  // Find the right size
  do {
    ctx.font = `900 ${fontSize}px ${NAME.fontFace}`;
    const measured = ctx.measureText(fullName).width;
    if (measured <= maxW || fontSize <= minSize) break;
    fontSize -= 2;
  } while (true);

  // Subtle shadow for legibility on any background
  ctx.shadowColor   = NAME.shadow;
  ctx.shadowBlur    = 8 * Math.min(sx, sy);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2 * Math.min(sx, sy);

  ctx.fillStyle = NAME.color;
  ctx.fillText(fullName, x, yBase);

  ctx.restore();
}

// ── ENSURE TEMPLATE LOADED ────────────────────────────────────────────────
function ensureTemplateLoaded() {
  if (templateImg.complete && templateImg.naturalWidth > 0) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    templateImg.onload  = resolve;
    templateImg.onerror = () => reject(new Error('Template image failed to load'));
  });
}

// ── PROGRESS HELPER ───────────────────────────────────────────────────────
function setProgress(pct, label) {
  progressFill.style.width  = pct + '%';
  progressLabel.textContent = label;
}

// ── DOWNLOAD ──────────────────────────────────────────────────────────────
btnDownload.addEventListener('click', () => {
  const name    = buildFullName().replace(/[^A-Z0-9 ]/gi, '').replace(/\s+/g, '_') || 'flyer';
  const dataURL = exportCanvas.toDataURL('image/png', 1.0);

  const a    = document.createElement('a');
  a.href     = dataURL;
  a.download = `NewWine2026_${name}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});

// ── INIT ──────────────────────────────────────────────────────────────────
// Pre-load template quietly on page load
templateImg.addEventListener('load', () => {
  console.log('[FlyerGen] Template loaded:', templateImg.naturalWidth, '×', templateImg.naturalHeight);
});
