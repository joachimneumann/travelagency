import sharp from "sharp";

const IMAGE_RENDER_SCALE = 2.4;
export const MARKETING_TOUR_PDF_BACKGROUND_COLOR = "#e4ecdf";
const HERO_BACKGROUND_IMAGE = Object.freeze({
  x: 118,
  y: 54,
  width: 466,
  height: 274
});

function smoothStep(edge0, edge1, value) {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const x = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return x * x * (3 - 2 * x);
}

function drawPolygonPath(doc, points) {
  points.forEach(([x, y], index) => {
    if (index === 0) doc.moveTo(x, y);
    else doc.lineTo(x, y);
  });
  doc.closePath();
}

function drawHeroBackgroundImage(doc, imageBuffer) {
  const { x, y, width, height } = HERO_BACKGROUND_IMAGE;
  if (imageBuffer) {
    doc.image(imageBuffer, x, y, { width, height });
    return;
  }

  const heroPoints = [
    [104, 58],
    [584, 56],
    [584, 257],
    [502, 290],
    [344, 282],
    [253, 230],
    [176, 145]
  ];
  doc.save();
  drawPolygonPath(doc, heroPoints);
  doc.clip();
  doc.rect(x, y, width, height).fill(MARKETING_TOUR_PDF_BACKGROUND_COLOR);
  doc.restore();
}

export async function createMarketingTourPdfBackgroundImageBuffer(imageBuffer) {
  if (!imageBuffer) return null;
  const width = Math.max(1, Math.round(HERO_BACKGROUND_IMAGE.width * IMAGE_RENDER_SCALE));
  const height = Math.max(1, Math.round(HERO_BACKGROUND_IMAGE.height * IMAGE_RENDER_SCALE));
  const alphaMask = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const leftAlpha = smoothStep(width * 0.02, width * 0.56, x);
      const topAlpha = smoothStep(0, height * 0.12, y);
      const bottomAlpha = 1 - smoothStep(height * 0.58, height, y);
      const alpha = Math.round(255 * Math.min(leftAlpha, topAlpha, bottomAlpha));
      const offset = (y * width + x) * 4;
      alphaMask[offset] = 255;
      alphaMask[offset + 1] = 255;
      alphaMask[offset + 2] = 255;
      alphaMask[offset + 3] = alpha;
    }
  }
  const maskBuffer = await sharp(alphaMask, {
    raw: {
      width,
      height,
      channels: 4
    }
  }).png().toBuffer();
  return await sharp(imageBuffer)
    .resize(width, height, { fit: "cover", position: "centre" })
    .ensureAlpha()
    .composite([{ input: maskBuffer, blend: "dest-in" }])
    .png()
    .toBuffer();
}

export function drawMarketingTourPdfBackground(doc, heroImageBuffer, { includeHeroImage = true } = {}) {
  doc.save();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(MARKETING_TOUR_PDF_BACKGROUND_COLOR);
  doc.restore();
  if (includeHeroImage) {
    drawHeroBackgroundImage(doc, heroImageBuffer);
  }
}
