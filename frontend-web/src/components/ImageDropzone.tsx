import { useState, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { X, Upload, ImageIcon } from "lucide-react";
import type { Id } from "../../convex/_generated/dataModel";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

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
      setError("Unsupported format. Use JPG, PNG, or WebP.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("File too large (max 2MB).");
      return;
    }

    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await res.json();
      setPreview(URL.createObjectURL(file));
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
    if (file) handleFile(file);
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
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`neo-border border-dashed p-6 text-center cursor-pointer transition-all ${
          dragOver ? "bg-accent/20 border-primary" : "bg-background"
        } ${uploading ? "opacity-50 pointer-events-none" : ""}`}
      >
        {uploading ? (
          <p className="font-heading font-bold text-sm uppercase animate-pulse">
            UPLOADING...
          </p>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ImageIcon size={20} strokeWidth={2.5} />
              <Upload size={20} strokeWidth={2.5} />
            </div>
            <p className="font-heading font-bold text-xs uppercase">
              Drop image or tap to upload
            </p>
            <p className="text-[10px] text-muted-foreground">
              JPG, PNG, WebP - Max 2MB
            </p>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {error && (
        <p className="text-destructive font-heading font-bold text-xs mt-2">
          {error}
        </p>
      )}
    </div>
  );
}
