import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Camera, Image as ImageIcon, ImageUp, Keyboard, Loader2, ScanLine, Search, X } from "lucide-react";
import { analyzeFood, type Analysis } from "@/lib/analyze.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResultCard } from "./ResultCard";
import { cn } from "@/lib/utils";

type Mode = "photo" | "camera" | "manual" | "search";

const modes: { id: Mode; label: string; icon: typeof Camera }[] = [
  { id: "photo", label: "Photo of pack", icon: ImageUp },
  { id: "camera", label: "Scan barcode", icon: Camera },
  { id: "manual", label: "Enter barcode", icon: Keyboard },
  { id: "search", label: "Search by name", icon: Search },
];

async function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_DIM = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function FoodScanner() {
  const [mode, setMode] = useState<Mode>("photo");
  const [text, setText] = useState("");
  const [barcode, setBarcode] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Analysis | null>(null);
  const [cameraOn, setCameraOn] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const scannerControlsRef = useRef<{ stop: () => void } | null>(null);
  const scanLockedRef = useRef(false);

  const analyze = useServerFn(analyzeFood);
  const { user } = useAuth();

  const stopCamera = () => {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    scanLockedRef.current = false;
    setCameraOn(false);
  };

  useEffect(() => () => stopCamera(), []);

  const run = async (payload: { name?: string; barcode?: string; imageBase64?: string }) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await analyze({ data: payload });
      if (!res) throw new Error("No response received from scanner.");
      setResult(res);
      if (user) {
        await supabase.from("scans").insert({
          user_id: user.id,
          food_name: res.foodName,
          brand: res.brand,
          barcode: res.barcode,
          grade: res.grade,
          score: res.score,
          summary: res.verdict,
          result: res as unknown as Record<string, unknown>,
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong during analysis");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelection = async (file?: File) => {
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      setPreview(compressed);
      await run({ imageBase64: compressed, name: text.trim() || undefined });
    } catch {
      toast.error("Failed to read image file.");
    }
  };

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera unavailable");
      setCameraOn(true);
      scanLockedRef.current = false;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const video = videoRef.current;
      if (!video) throw new Error("Camera preview unavailable");
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
        import("@zxing/browser"),
        import("@zxing/library"),
      ]);
      const formats = [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.ITF,
        BarcodeFormat.DATA_MATRIX,
        BarcodeFormat.QR_CODE,
      ];
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
      hints.set(DecodeHintType.TRY_HARDER, true);
      const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 180 });
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } },
        video,
        (scanResult) => {
          const code = scanResult?.getText().replace(/\D/g, "");
          if (!code || code.length < 8 || scanLockedRef.current) return;
          scanLockedRef.current = true;
          controls.stop();
          scannerControlsRef.current = null;
          setCameraOn(false);
          setBarcode(code);
          toast.success(`Barcode ${code} detected`);
          void run({ barcode: code });
        },
      );
      scannerControlsRef.current = controls;
    } catch {
      stopCamera();
      toast.error("Couldn't open the camera. Try a photo or type the barcode instead.");
    }
  };

  const captureFrame = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    const MAX_DIM = 1024;
    let width = video.videoWidth;
    let height = video.videoHeight;

    if (width > height) {
      if (width > MAX_DIM) {
        height = Math.round((height * MAX_DIM) / width);
        width = MAX_DIM;
      }
    } else {
      if (height > MAX_DIM) {
        width = Math.round((width * MAX_HEIGHT) / height);
        height = MAX_DIM;
      }
    }

    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
    stopCamera();
    setPreview(dataUrl);
    void run({ imageBase64: dataUrl });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border bg-card p-4 shadow-soft sm:p-6">
        <div className="flex flex-wrap gap-2">
          {modes.map((m) => (
            <Button
              key={m.id}
              type="button"
              variant={mode === m.id ? "default" : "secondary"}
              onClick={() => {
                stopCamera();
                setMode(m.id);
              }}
              className={cn("rounded-full border", mode === m.id && "border-primary")}
            >
              <m.icon className="size-4" />
              {m.label}
            </Button>
          ))}
        </div>

        <div className="mt-5">
          {mode === "photo" && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-border bg-secondary/50 p-8 text-center">
                <ImageUp className="size-8 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Upload or capture food label</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Ingredients and nutrition panel work best</p>
                </div>

                {/* Hidden File Inputs controlled via explicit refs */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    void handleFileSelection(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    void handleFileSelection(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-xl"
                  >
                    <Camera className="size-4" />
                    Take Photo
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => galleryInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-xl"
                  >
                    <ImageIcon className="size-4" />
                    Choose from Gallery
                  </Button>
                </div>
              </div>

              {preview && (
                <img
                  src={preview}
                  alt="Scanned food package"
                  className="mx-auto max-h-56 rounded-2xl border object-contain shadow-sm"
                />
              )}
            </div>
          )}

          {mode === "camera" && (
            <div className="space-y-3">
              {cameraOn ? (
                <div className="relative overflow-hidden rounded-2xl border bg-foreground/90">
                  <video ref={videoRef} playsInline muted className="max-h-80 w-full object-contain" />
                  <div className="pointer-events-none absolute inset-x-10 top-1/2 h-24 -translate-y-1/2 rounded-xl border-2 border-accent" />
                  <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
                    <span className="inline-flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
                      <ScanLine className="size-4 text-primary" /> Hold steady and fill the frame
                    </span>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 p-3">
                    <Button type="button" onClick={captureFrame}>
                      Capture instead
                    </Button>
                    <Button type="button" variant="secondary" onClick={stopCamera}>
                      <X className="size-4" /> Stop
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border-2 border-dashed bg-secondary/50 p-10 text-center">
                  <p className="font-medium">Point your camera at the barcode</p>
                  <p className="mb-4 text-sm text-muted-foreground">
                    We detect the code automatically and pull the product details.
                  </p>
                  <Button type="button" onClick={startCamera}>
                    <Camera className="size-4" /> Open camera
                  </Button>
                </div>
              )}
            </div>
          )}

          {mode === "manual" && (
            <form
              className="flex flex-col gap-3 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                if (barcode.trim()) void run({ barcode: barcode.trim() });
              }}
            >
              <Input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                inputMode="numeric"
                placeholder="e.g. 8901058000108"
                className="h-12 rounded-xl"
              />
              <Button type="submit" className="h-12" disabled={loading || !barcode.trim()}>
                Check barcode
              </Button>
            </form>
          )}

          {mode === "search" && (
            <form
              className="flex flex-col gap-3 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                if (text.trim()) void run({ name: text.trim() });
              }}
            >
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="e.g. Maggi 2-minute noodles, Coke, paneer tikka"
                className="h-12 rounded-xl"
              />
              <Button type="submit" className="h-12" disabled={loading || !text.trim()}>
                Grade it
              </Button>
            </form>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-3 rounded-3xl border bg-card p-10 shadow-soft">
          <Loader2 className="size-5 animate-spin text-primary" />
          <span className="font-medium">Reading the label and grading…</span>
        </div>
      )}

      {result && !loading && <ResultCard result={result} />}
      {!user && result && !loading && (
        <p className="text-center text-sm text-muted-foreground">
          Sign in to keep this scan in your history.
        </p>
      )}
    </div>
  );
}
