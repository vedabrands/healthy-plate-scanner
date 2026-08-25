import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Camera, ImageUp, Keyboard, Loader2, Search, X } from "lucide-react";
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

export function FoodScanner() {
  const [mode, setMode] = useState<Mode>("photo");
  const [text, setText] = useState("");
  const [barcode, setBarcode] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Analysis | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyze = useServerFn(analyzeFood);
  const { user } = useAuth();

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  useEffect(() => () => stopCamera(), []);

  const run = async (payload: { name?: string; barcode?: string; imageBase64?: string }) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await analyze({ data: payload });
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
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setPreview(dataUrl);
      void run({ imageBase64: dataUrl, name: text.trim() || undefined });
    };
    reader.readAsDataURL(file);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setCameraOn(true);
      requestAnimationFrame(async () => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        void detectLoop();
      });
    } catch {
      toast.error("Couldn't open the camera. Try a photo or type the barcode instead.");
    }
  };

  const detectLoop = async () => {
    const Detector = (window as unknown as { BarcodeDetector?: new (o?: unknown) => { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> } })
      .BarcodeDetector;
    if (!Detector) {
      toast.message("Live barcode scanning isn't supported in this browser — snap a photo of the barcode instead.");
      return;
    }
    const detector = new Detector({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"],
    });
    const tick = async () => {
      if (!streamRef.current || !videoRef.current) return;
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes.length > 0 && codes[0]?.rawValue) {
          const code = codes[0].rawValue;
          stopCamera();
          setBarcode(code);
          toast.success(`Barcode ${code} detected`);
          void run({ barcode: code });
          return;
        }
      } catch {
        /* keep trying */
      }
      setTimeout(() => void tick(), 400);
    };
    void tick();
  };

  const captureFrame = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    stopCamera();
    setPreview(dataUrl);
    void run({ imageBase64: dataUrl });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border bg-card p-4 shadow-soft sm:p-6">
        <div className="flex flex-wrap gap-2">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                stopCamera();
                setMode(m.id);
              }}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                mode === m.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-accent/30",
              )}
            >
              <m.icon className="size-4" />
              {m.label}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {mode === "photo" && (
            <div className="space-y-3">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-secondary/50 p-10 text-center transition-colors hover:border-primary">
                <ImageUp className="size-7 text-primary" />
                <span className="font-medium">Upload or snap the pack / label</span>
                <span className="text-sm text-muted-foreground">
                  Ingredients list works best
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onFile(f);
                  }}
                />
              </label>
              {preview ? (
                <img
                  src={preview}
                  alt="Scanned food package"
                  className="mx-auto max-h-56 rounded-2xl border object-contain"
                />
              ) : null}
            </div>
          )}

          {mode === "camera" && (
            <div className="space-y-3">
              {cameraOn ? (
                <div className="relative overflow-hidden rounded-2xl border bg-foreground/90">
                  <video ref={videoRef} playsInline muted className="max-h-80 w-full object-contain" />
                  <div className="pointer-events-none absolute inset-x-10 top-1/2 h-24 -translate-y-1/2 rounded-xl border-2 border-accent" />
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
