import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

interface ImageZoomModalProps {
  imageUrl: string;
  open: boolean;
  onClose: () => void;
}

export function ImageZoomModal({ imageUrl, open, onClose }: ImageZoomModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-2 bg-black/95 border-none">
        <img
          src={imageUrl}
          alt="Zoomed question image"
          className="w-full h-full object-contain max-h-[85vh]"
        />
      </DialogContent>
    </Dialog>
  );
}
