import type { ImageRequirement } from "./opportunities.ts";

export type SafeImageType = "image/jpeg" | "image/png" | "image/webp";
export interface CropPosition { x: number; y: number }

const MAX_INPUT_BYTES = 20 * 1024 * 1024;
const MAX_PIXELS = 16_000_000;

export function imageTypeFromSignature(bytes: Uint8Array): SafeImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((part, index) => bytes[index] === part)) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

function mimeFormat(value: string): SafeImageType | null {
  const normalized = value.toLowerCase().replace(/^\./, "").trim();
  if (["jpg", "jpeg", "image/jpeg"].includes(normalized)) return "image/jpeg";
  if (["png", "image/png"].includes(normalized)) return "image/png";
  if (["webp", "image/webp"].includes(normalized)) return "image/webp";
  return null;
}

export function outputFormats(requirement: ImageRequirement): SafeImageType[] {
  return [...new Set(requirement.formats.map(mimeFormat).filter((value): value is SafeImageType => value !== null))];
}

export function canResize(requirement: ImageRequirement): boolean {
  const { width, height } = requirement;
  return requirement.verified === true && width !== undefined && height !== undefined &&
    Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 &&
    width * height <= MAX_PIXELS && outputFormats(requirement).length > 0 &&
    (requirement.maxBytes === undefined || (Number.isInteger(requirement.maxBytes) && requirement.maxBytes > 0));
}

async function blobWithQuality(canvas: HTMLCanvasElement, format: SafeImageType, quality: number): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, format, quality));
  if (!blob) throw new Error("Browser could not encode this image.");
  return blob;
}

/** Browser-only. No fetch, uploads, or external image processor. */
export async function resizeImage(file: File, requirement: ImageRequirement, position: CropPosition, format: SafeImageType): Promise<Blob> {
  if (!canResize(requirement)) throw new Error("Verified output dimensions and format are required.");
  if (!outputFormats(requirement).includes(format)) throw new Error("Output format is not listed in official requirements.");
  if (file.size < 12 || file.size > MAX_INPUT_BYTES) throw new Error("Input image must be between 12 bytes and 20 MiB.");
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || position.x < 0 || position.x > 1 || position.y < 0 || position.y > 1) {
    throw new Error("Crop position is invalid.");
  }
  const inputType = imageTypeFromSignature(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  if (!inputType) throw new Error("Select a JPEG, PNG, or WebP image. SVG and other formats are not accepted.");
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width < 1 || bitmap.height < 1 || bitmap.width * bitmap.height > MAX_PIXELS) throw new Error("Image dimensions exceed safe processing limit.");
    const width = requirement.width!;
    const height = requirement.height!;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Browser canvas is unavailable.");
    const targetAspect = width / height;
    const sourceAspect = bitmap.width / bitmap.height;
    const cropWidth = sourceAspect > targetAspect ? bitmap.height * targetAspect : bitmap.width;
    const cropHeight = sourceAspect > targetAspect ? bitmap.height : bitmap.width / targetAspect;
    const sx = (bitmap.width - cropWidth) * position.x;
    const sy = (bitmap.height - cropHeight) * position.y;
    if (format === "image/jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(bitmap, sx, sy, cropWidth, cropHeight, 0, 0, width, height);
    let output = await blobWithQuality(canvas, format, 0.92);
    const maxBytes = requirement.maxBytes;
    if (maxBytes && output.size > maxBytes && format !== "image/png") {
      let low = 0.35;
      let high = 0.92;
      let best: Blob | null = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        const middle = (low + high) / 2;
        const candidate = await blobWithQuality(canvas, format, middle);
        if (candidate.size <= maxBytes) { best = candidate; low = middle; }
        else high = middle;
      }
      if (best) output = best;
    }
    if (maxBytes && output.size > maxBytes) throw new Error("Could not meet official file-size limit. Try another source image or format.");
    const signature = imageTypeFromSignature(new Uint8Array(await output.slice(0, 16).arrayBuffer()));
    if (signature !== format) throw new Error("Browser produced a different image format than requested.");
    const check = await createImageBitmap(output);
    try {
      if (check.width !== width || check.height !== height) throw new Error("Output dimensions do not match official requirements.");
    } finally { check.close(); }
    return output;
  } finally { bitmap.close(); }
}
