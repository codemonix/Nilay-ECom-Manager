/**
 * Longest side of an uploaded photo, in pixels. Matches Telegram's "HD"
 * photos: enough to zoom in on a shipping label's address or a scratch on
 * an item later, at a fraction of a raw phone photo's size.
 */
export const PHOTO_MAX_DIMENSION = 2560;
/** JPEG quality for re-encoded photos -- visually lossless for photos, roughly 0.3-1 MB at 2560px. */
export const PHOTO_JPEG_QUALITY = 0.85;

/**
 * Encoding passes, best first. The first is the normal result; the rest
 * only run when a photo still exceeds the configured upload limit (see
 * IMAGE_UPLOAD_LIMITS), trading quality before resolution.
 */
const ENCODING_STEPS: Array<{ maxDimension: number; quality: number }> = [
  { maxDimension: PHOTO_MAX_DIMENSION, quality: PHOTO_JPEG_QUALITY },
  { maxDimension: PHOTO_MAX_DIMENSION, quality: 0.75 },
  { maxDimension: 2048, quality: 0.75 },
  { maxDimension: 1600, quality: 0.7 },
  { maxDimension: 1280, quality: 0.65 },
];

/** Formats left as they are: GIFs would lose their animation when re-encoded. */
const PASSTHROUGH_IMAGE_TYPES = new Set(["image/gif", "image/svg+xml"]);

/** Scales width x height down (never up) so the longer side is at most maxDimension, keeping the aspect ratio. */
export function fitWithin(width: number, height: number, maxDimension: number): { width: number; height: number } {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === "function") {
    // "from-image" applies the photo's EXIF rotation, so portrait phone shots stay upright.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
}

function encode(source: CanvasImageSource, width: number, height: number, quality: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas 2D context is unavailable"));
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the photo"))), "image/jpeg", quality),
  );
}

/**
 * Downscales and re-encodes a photo as JPEG (see PHOTO_MAX_DIMENSION /
 * PHOTO_JPEG_QUALITY) before upload, stepping down through ENCODING_STEPS
 * while the result is over maxBytes. Keeps the original when it is already
 * a JPEG within both bounds and smaller than the re-encoded result. Throws
 * when the browser can't decode the image.
 */
export async function compressPhoto(file: File, maxBytes: number): Promise<File> {
  const decoded = await decode(file);
  try {
    let blob: Blob | null = null;
    let first = true;
    for (const step of ENCODING_STEPS) {
      const { width, height } = fitWithin(decoded.width, decoded.height, step.maxDimension);
      blob = await encode(decoded.source, width, height, step.quality);
      if (first) {
        const originalFits =
          file.type === "image/jpeg" && width === decoded.width && height === decoded.height && file.size <= maxBytes;
        if (originalFits && file.size <= blob.size) return file;
        first = false;
      }
      if (blob.size <= maxBytes) break;
    }
    const baseName = file.name.replace(/\.[^.]*$/, "") || "photo";
    return new File([blob as Blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    decoded.release();
  }
}

/**
 * What every upload goes through: images are compressed (compressPhoto),
 * anything else -- PDFs, GIFs -- is returned unchanged.
 */
export async function prepareImageUpload(file: File, maxBytes: number): Promise<File> {
  if (!file.type.startsWith("image/") || PASSTHROUGH_IMAGE_TYPES.has(file.type)) return file;
  return compressPhoto(file, maxBytes);
}
