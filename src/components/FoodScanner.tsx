import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Camera,
  Check,
  Flashlight,
  FlashlightOff,
  FlipHorizontal,
  Image as ImageIcon,
  ImageUp,
  Keyboard,
  Loader2,
  RefreshCw,
  ScanLine,
  Search,
  X,
} from "lucide-react";
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
        resolve(canvas.toDataURL("image/jpeg", 0.8));
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

  // Live Camera Controls State
  const [liveCameraActive, setLiveCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasTorchCapability, setHasTorchCapability] = useState(false);

  const photoVideoRef = useRef<HTMLVideoElement | null>(null);
  const barcodeVideoRef = useRef<HTMLVideoElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const scannerControlsRef = useRef<{ stop: () => void } | null>(null);
  const scanLockedRef = useRef(false);

  const analyze = useServerFn(analyzeFood);
  const { user } = useAuth();

  const stopAllCameras = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => {
        try {
          if (t.kind === "video" && "applyConstraints" in t) {
            void (t as MediaStreamTrack).applyConstraints({
              // @ts-expect-error advanced torch constraint
              advanced: [{ torch: false }],
            });
          }
        } catch {
          // ignore cleanup errors
        }
        t.stop();
      });
      setCameraStream(null);
    }
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    scanLockedRef.current = false;
    setLiveCameraActive(false);
    setTorchEnabled(false);
    setHasTorchCapability(false);
  };

  useEffect(() => () => stopAllCameras(), []);

  const toggleTorch = async () => {
    if (!cameraStream) return;
    const track = cameraStream.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextState = !torchEnabled;
      // @ts-expect-error advanced torch constraint
      await track.applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchEnabled(nextState);
    } catch {
      toast.error("Flash is not supported on this device/camera.");
    }
  };

  const flipCamera = async () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    if (liveCameraActive) {
      stopAllCameras();
      if (mode === "photo") {
        await startPhotoCamera(nextMode);
      } else if (mode === "camera") {
        await startBarcodeCamera(nextMode);
      }
    }
  };

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

  const handleGallerySelection = async (file?: File) => {
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      setPreview(compressed);
      setResult(null);
    } catch {
      toast.error("Failed to read image file.");
    }
  };

  // Live Camera for Photo Mode
  const startPhotoCamera = async (facing: "environment" | "user" = facingMode) => {
    stopAllCameras();
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera unavailable");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      setCameraStream(stream);
      setLiveCameraActive(true);

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        // @ts-expect-error getCapabilities support
        const capabilities = videoTrack.getCapabilities?.();
        if (capabilities && "torch" in capabilities) {
          setHasTorchCapability(true);
        }
      }

      setTimeout(async () => {
        if (photoVideoRef.current) {
          photoVideoRef.current.srcObject = stream;
          try {
            await photoVideoRef.current.play();
          } catch (playErr) {
            console.warn("Autoplay prevented:", playErr);
          }
        }
      }, 50);
    } catch {
      stopAllCameras();
      toast.error("Couldn't open camera. Please check camera permissions.");
    }
  };

  const snapPhotoFromStream = () => {
    const video = photoVideoRef.current;
    const track = cameraStream?.getVideoTracks()[0];
    const settings = track?.getSettings();

    let width = video?.videoWidth || settings?.width || 1280;
    let height = video?.videoHeight || settings?.height || 720;

    if (!video) {
      toast.error("Camera preview unavailable.");
      return;
    }

    const canvas = document.createElement("canvas");
    const MAX_DIM = 1024;

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
    if (!ctx) return;

    try {
      ctx.drawImage(video, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

      stopAllCameras();
      setPreview(dataUrl);
      setResult(null);
    } catch {
      toast.error("Failed to capture frame. Please try again.");
    }
  };

  // Barcode Scanner Camera
  const startBarcodeCamera = async (facing: "environment" | "user" = facingMode) => {
    stopAllCameras();
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera unavailable");
      setLiveCameraActive(true);
      scanLockedRef.current = false;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const video = barcodeVideoRef.current;
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
        {
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        },
        video,
        (scanResult) => {
          const code = scanResult?.getText().replace(/\D/g, "");
          if (!code || code.length < 8 || scanLockedRef.current) return;
          scanLockedRef.current = true;
          controls.stop();
          scannerControlsRef.current = null;
          setLiveCameraActive(false);
          setBarcode(code);
          toast.success(`Barcode ${code} detected`);
          void run({ barcode: code });
        }
      );

      scannerControlsRef.current = controls;
    } catch {
      stopAllCameras();
      toast.error("Couldn't open the barcode camera.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-neutral-200/80 bg-white/90 p-4 shadow-soft sm:p-6 backdrop-blur-md">
        {/* Unblocked Interactive Mode Selector */}
        <div className="flex flex-wrap gap-2">
          {modes.map((m) => {
            const isActive = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  stopAllCameras();
                  setPreview(null);
                  setMode(m.id);
                }}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-full border transition-all duration-150 cursor-pointer select-none",
                  isActive
                    ? "bg-emerald-600 text-white border-emerald-500 shadow-md scale-100"
                    : "bg-neutral-100/90 hover:bg-neutral-200 text-neutral-800 border-neutral-300"
                )}
              >
                <m.icon className={cn("size-4", isActive ? "text-white" : "text-neutral-600")} />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5">
          {mode === "photo" && (
            <div className="space-y-4">
              {liveCameraActive ? (
                <div className="relative overflow-hidden rounded-2xl border bg-foreground/90">
                  <video
                    ref={photoVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="max-h-96 w-full object-contain"
                  />

                  {/* Flash & Flip Controls */}
                  <div className="absolute inset-x-0 top-3 flex items-center justify-between px-4">
                    {hasTorchCapability ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        onClick={toggleTorch}
                        className="rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80"
                      >
                        {torchEnabled ? (
                          <Flashlight className="size-5 text-amber-400" />
                        ) : (
                          <FlashlightOff className="size-5" />
                        )}
                      </Button>
                    ) : (
                      <div />
                    )}

                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      onClick={flipCamera}
                      className="rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80"
                    >
                      <FlipHorizontal className="size-5" />
                    </Button>
                  </div>

                  {/* Bottom Action Bar */}
                  <div className="absolute inset-x-0 bottom-0 flex justify-center gap-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
                    <Button
                      type="button"
                      onClick={snapPhotoFromStream}
                      className="rounded-xl px-6 py-2.5 font-medium shadow-lg"
                    >
                      <Camera className="mr-2 size-4" /> Capture Photo
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={stopAllCameras}
                      className="rounded-xl"
                    >
                      <X className="size-4" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : preview ? (
                <div className="space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4 text-center">
                  <img
                    src={preview}
                    alt="Captured label"
                    className="mx-auto max-h-72 rounded-xl border object-contain shadow-sm"
                  />
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setPreview(null);
                        void startPhotoCamera();
                      }}
                      className="rounded-xl"
                      disabled={loading}
                    >
                      <RefreshCw className="mr-2 size-4" /> Retake Photo
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void run({ imageBase64: preview, name: text.trim() || undefined })}
                      className="rounded-xl px-6 bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={loading}
                    >
                      <Check className="mr-2 size-4" /> Grade this Label
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50/80 p-8 text-center">
                  <ImageUp className="size-8 text-emerald-600" />
                  <div>
                    <p className="font-semibold text-neutral-900">Upload or capture food label</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      Ingredients and nutrition panel work best
                    </p>
                  </div>

                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      void handleGallerySelection(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />

                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button
                      type="button"
                      onClick={() => void startPhotoCamera()}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Camera className="size-4" />
                      Take Photo
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => galleryInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-xl border-neutral-300 text-neutral-800"
                    >
                      <ImageIcon className="size-4" />
                      Choose from Gallery
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === "camera" && (
            <div className="space-y-3">
              {liveCameraActive ? (
                <div className="relative overflow-hidden rounded-2xl border bg-foreground/90">
                  <video
                    ref={barcodeVideoRef}
                    playsInline
                    muted
                    className="max-h-80 w-full object-contain"
                  />

                  <div className="absolute right-3 top-3">
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      onClick={flipCamera}
                      className="rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80"
                    >
                      <FlipHorizontal className="size-5" />
                    </Button>
                  </div>

                  <div className="pointer-events-none absolute inset-x-10 top-1/2 h-24 -translate-y-1/2 rounded-xl border-2 border-emerald-400" />
                  <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
                    <span className="inline-flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
                      <ScanLine className="size-4 text-emerald-600" /> Hold steady and fill the frame
                    </span>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 p-3">
                    <Button type="button" variant="secondary" onClick={stopAllCameras}>
                      <X className="size-4" /> Stop
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50/80 p-10 text-center">
                  <p className="font-semibold text-neutral-900">Point your camera at the barcode</p>
                  <p className="mb-4 text-sm text-neutral-500">
                    We detect the code automatically and pull the product details.
                  </p>
                  <Button type="button" onClick={() => void startBarcodeCamera()} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Camera className="size-4 mr-2" /> Open camera
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
                className="h-12 rounded-xl bg-white text-neutral-950 placeholder:text-neutral-500 font-medium border-neutral-300 shadow-inner"
              />
              <Button type="submit" className="h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-medium" disabled={loading || !barcode.trim()}>
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
                className="h-12 rounded-xl bg-white text-neutral-950 placeholder:text-neutral-500 font-medium border-neutral-300 shadow-inner"
              />
              <Button type="submit" className="h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-medium" disabled={loading || !text.trim()}>
                Grade it
              </Button>
            </form>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-3 rounded-3xl border border-neutral-200 bg-white/95 p-10 shadow-soft">
          <Loader2 className="size-5 animate-spin text-emerald-600" />
          <span className="font-semibold text-neutral-800">Reading the label and grading…</span>
        </div>
      )}

      {result && !loading && <ResultCard result={result} />}
      {!user && result && !loading && (
        <p className="text-center text-sm font-medium text-neutral-400">
          Sign in to keep this scan in your history.
        </p>
      )}
    </div>
  );
}
