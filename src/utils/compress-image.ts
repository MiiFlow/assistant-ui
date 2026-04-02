/**
 * Client-side image compression utility.
 *
 * The Claude API rejects base64-encoded images larger than 5 MB.
 * Because base64 inflates size by ~33%, we target a raw file size
 * of MAX_IMAGE_BYTES (4 MB) so the encoded payload stays safely
 * under the limit.
 */

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB raw ≈ 5.3 MB base64 (safe margin)
const MAX_DIMENSION = 4096;

const COMPRESSIBLE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/bmp",
]);

function isCompressible(file: File): boolean {
  return COMPRESSIBLE_TYPES.has(file.type);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

function canvasToBlob(
  img: HTMLImageElement,
  scale: number,
  quality: number,
  outputType: string,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Canvas 2D context unavailable"));
      return;
    }

    ctx.drawImage(img, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob returned null"));
      },
      outputType,
      quality,
    );
  });
}

/**
 * Compress an image File so its size is ≤ MAX_IMAGE_BYTES.
 */
export async function compressImageIfNeeded(file: File): Promise<File> {
  if (!isCompressible(file) || file.size <= MAX_IMAGE_BYTES) {
    return file;
  }

  const img = await loadImage(file);

  const dimScale = Math.min(
    1,
    MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight),
  );

  const outputType = "image/jpeg";
  const qualities = [0.85, 0.7, 0.5, 0.3, 0.15];
  const scales = [dimScale, dimScale * 0.75, dimScale * 0.5, dimScale * 0.25];

  for (const q of qualities) {
    const blob = await canvasToBlob(img, dimScale, q, outputType);
    if (blob.size <= MAX_IMAGE_BYTES) {
      return blobToFile(blob, file.name, outputType);
    }
  }

  for (const s of scales.slice(1)) {
    for (const q of qualities) {
      const blob = await canvasToBlob(img, s, q, outputType);
      if (blob.size <= MAX_IMAGE_BYTES) {
        return blobToFile(blob, file.name, outputType);
      }
    }
  }

  const lastResort = await canvasToBlob(img, 0.1, 0.1, outputType);
  return blobToFile(lastResort, file.name, outputType);
}

function blobToFile(blob: Blob, originalName: string, mimeType: string): File {
  const name = originalName.replace(/\.[^.]+$/, ".jpg");
  return new File([blob], name, { type: mimeType, lastModified: Date.now() });
}
