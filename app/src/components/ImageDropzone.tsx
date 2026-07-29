import { useState, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { X, Upload, ImageIcon } from "lucide-react";
import type { Id } from "../../convex/_generated/dataModel";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
// Question images render in a ~320px-tall letterbox; anything beyond this edge
// length is wasted bytes on every player's connection.
const MAX_EDGE_PX = 1280;
const JPEG_QUALITY = 0.85;

/**
 * Decode + downscale + re-encode before upload, so storage only ever holds
 * browser-renderable, size-bounded images. This is what keeps HEIC out of the
 * pool: Safari (where HEIC uploads come from) decodes it natively and we
 * re-encode to JPEG; a browser that can't decode the file rejects here with a
 * clear error instead of shipping a blob other players' browsers choke on.
 * PNG stays PNG (badge images need their alpha channel); everything else
 * becomes JPEG.
 */
async function normalizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    ctx.drawImage(bitmap, 0, 0, width, height);
    const outType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outType, JPEG_QUALITY),
    );
    if (!blob) throw new Error("encode failed");
    return blob;
  } finally {
    bitmap.close();
  }
}

interface ImageDropzoneProps {
  imageId: Id<"_storage"> | null;
  onUpload: (imageId: Id<"_storage">) => void;
  onRemove: () => void;
}

export function ImageDropzone({ imageId, onUpload, onRemove }: ImageDropzoneProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);

  const handleFile = async (file: File) => {
    setError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Unsupported format. Use JPG, PNG, WebP, or HEIC.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("File too large (max 2MB).");
      return;
    }

    setUploading(true);
    try {
      let normalized: Blob;
      try {
        normalized = await normalizeImage(file);
      } catch {
        // Couldn't decode locally (e.g. HEIC outside Safari) — the pool must
        // never receive a blob this very browser can't render.
        setError("Couldn't read that image. Try a JPG, PNG, or WebP.");
        return;
      }
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": normalized.type },
        body: normalized,
      });
      if (!res.ok) throw new Error("Upload request failed");
      const { storageId } = await res.json();
      setPreview(URL.createObjectURL(normalized));
      onUpload(storageId);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const handleRemove = () => {
    setPreview(null);
    setError(null);
    onRemove();
    if (inputRef.current) inputRef.current.value = "";
  };

  if (imageId && preview) {
    return (
      <div className="relative neo-border p-2">
        <img src={preview} alt="Upload preview" className="w-full object-contain max-h-40" />
        <button
          type="button"
          onClick={handleRemove}
          className="absolute top-3 right-3 neo-border rounded-full w-7 h-7 flex items-center justify-center bg-destructive text-destructive-foreground cursor-pointer"
        >
          <X size={14} strokeWidth={3} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative neo-border border-dashed p-6 text-center cursor-pointer transition-all ${
          dragOver ? "bg-accent/20 border-primary" : "bg-background"
        } ${uploading ? "opacity-50 pointer-events-none" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          aria-label="Add a question image"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        {uploading ? (
          <p className="font-heading font-bold text-sm uppercase animate-pulse">
            UPLOADING...
          </p>
        ) : (
          <div className="flex flex-col items-center gap-2 pointer-events-none">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ImageIcon size={20} strokeWidth={2.5} />
              <Upload size={20} strokeWidth={2.5} />
            </div>
            <p className="font-heading font-bold text-xs uppercase">
              Drop image or tap to upload
            </p>
            <p className="text-[10px] text-muted-foreground">
              JPG, PNG, WebP, HEIC - Max 2MB
            </p>
          </div>
        )}
      </div>
      {error && (
        <p className="text-destructive font-heading font-bold text-xs mt-2">
          {error}
        </p>
      )}
    </div>
  );
}
