"use client";
import { useState, useCallback, useRef } from "react";
import Cropper from "react-easy-crop";
import { X, ZoomIn, ZoomOut, RotateCcw, Check, Crop } from "lucide-react";

interface Point { x: number; y: number; }
interface Area { x: number; y: number; width: number; height: number; }

interface ImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
  aspectRatio?: number; // undefined = libre
}

const RATIOS = [
  { label: "Libre", value: undefined },
  { label: "Carré 1:1", value: 1 },
  { label: "Portrait 3:4", value: 3 / 4 },
  { label: "Paysage 4:3", value: 4 / 3 },
  { label: "Large 16:9", value: 16 / 9 },
];

async function getCroppedImg(imageSrc: string, pixelCrop: Area, rotation = 0): Promise<Blob> {
  const image = await createImageBitmap(await (await fetch(imageSrc)).blob());
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  const maxSize = Math.max(image.width, image.height);
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

  canvas.width = safeArea;
  canvas.height = safeArea;

  ctx.translate(safeArea / 2, safeArea / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-safeArea / 2, -safeArea / 2);
  ctx.drawImage(image, safeArea / 2 - image.width / 2, safeArea / 2 - image.height / 2);

  const data = ctx.getImageData(0, 0, safeArea, safeArea);
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.putImageData(
    data,
    Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x),
    Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y)
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.95);
  });
}

export default function ImageCropper({ imageSrc, onCropComplete, onCancel }: ImageCropperProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState<number | undefined>(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const onCropChange = useCallback((crop: Point) => setCrop(crop), []);
  const onZoomChange = useCallback((zoom: number) => setZoom(zoom), []);

  const onCropCompleteCallback = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleDone = async () => {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
      onCropComplete(blob);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 z-10">
        <button onClick={onCancel} className="text-white p-2 rounded-xl hover:bg-white/10">
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-white font-bold">Recadrer l&apos;image</h3>
        <button onClick={handleDone} disabled={processing}
          className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-xl font-semibold text-sm">
          {processing ? "..." : <><Check className="w-4 h-4" /> Valider</>}
        </button>
      </div>

      {/* Crop area */}
      <div className="flex-1 relative">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={aspect}
          onCropChange={onCropChange}
          onZoomChange={onZoomChange}
          onCropComplete={onCropCompleteCallback}
          style={{
            containerStyle: { background: "#000" },
            cropAreaStyle: { border: "2px solid #F97316" },
          }}
        />
      </div>

      {/* Contrôles */}
      <div className="bg-black/90 px-4 py-4 space-y-3">
        {/* Ratios */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {RATIOS.map((r) => (
            <button key={r.label} onClick={() => setAspect(r.value)}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                aspect === r.value ? "bg-orange-500 text-white border-orange-500" : "border-white/30 text-white/70"
              }`}>
              {r.label}
            </button>
          ))}
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-3">
          <ZoomOut className="w-4 h-4 text-white/60 shrink-0" />
          <input type="range" min={1} max={3} step={0.01} value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-orange-500" />
          <ZoomIn className="w-4 h-4 text-white/60 shrink-0" />
        </div>

        {/* Rotation */}
        <div className="flex items-center gap-3">
          <RotateCcw className="w-4 h-4 text-white/60 shrink-0" />
          <input type="range" min={-180} max={180} step={1} value={rotation}
            onChange={(e) => setRotation(Number(e.target.value))}
            className="flex-1 accent-orange-500" />
          <span className="text-white/60 text-xs w-10 text-right">{rotation}°</span>
        </div>
      </div>
    </div>
  );
}
