"use client";

// ─────────────────────────────────────────────────────────────
// Client-side image downscaling for proof-of-delivery photos.
//
// A modern phone camera produces 3-8 MB JPEGs. Proof of delivery only needs to
// show that the right goods reached the right person, so storing originals burns
// Storage quota (and the rider's mobile data) for detail nobody looks at.
//
// Compressing in the browser BEFORE upload is what saves the bandwidth, doing
// it server-side would mean paying to transfer the full-size file anyway. Cost
// is a few hundred ms of canvas work per photo on the rider's device.
//
// Fails open: if anything goes wrong (unsupported codec, OOM on a huge image,
// no canvas), the original File is returned rather than losing the evidence.
// ─────────────────────────────────────────────────────────────

export interface CompressOptions {
  /** Longest edge in pixels. 1600 keeps a label or door number legible. */
  maxEdge?: number;
  /** JPEG quality, 0-1. 0.7 is visually clean at this size. */
  quality?: number;
  /** Skip work entirely for files already smaller than this (bytes). */
  skipBelowBytes?: number;
}

const DEFAULTS: Required<CompressOptions> = {
  maxEdge: 1600,
  quality: 0.7,
  skipBelowBytes: 250 * 1024, // 250 KB, already small enough to store as-is
};

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
      reject(new Error("decode-failed"));
    };
    img.src = url;
  });
}

/**
 * Downscale + re-encode a single image. Returns the ORIGINAL file unchanged if
 * it is already small, is not an image, or if compression fails or would make
 * the file bigger (which can happen re-encoding an already-optimised JPEG).
 */
export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  const { maxEdge, quality, skipBelowBytes } = { ...DEFAULTS, ...opts };

  if (!file.type.startsWith("image/")) return file;
  // HEIC/HEIF often cannot be decoded by canvas; attempting it throws and we
  // would fall through to the original anyway, so skip the wasted work.
  if (/heic|heif/i.test(file.type)) return file;
  if (file.size <= skipBelowBytes) return file;

  try {
    const img = await loadImage(file);
    const { width, height } = img;
    if (!width || !height) return file;

    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
    );
    if (!blob || blob.size >= file.size) return file;

    // Normalise the name to .jpg since the bytes are now JPEG.
    const base = file.name.replace(/\.[^./\\]+$/, "") || "photo";
    return new File([blob], `${base}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}

/** Compress a list of images, preserving order. Never rejects. */
export async function compressImages(
  files: File[],
  opts: CompressOptions = {}
): Promise<File[]> {
  return Promise.all(files.map((f) => compressImage(f, opts).catch(() => f)));
}

/** Human-readable byte size, for showing the saving to the operator. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
