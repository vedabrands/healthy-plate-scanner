import type { Analysis, AnalysisInput } from "./analyze.types";

type Product = {
  product_name?: string;
  brands?: string;
  ingredients_text?: string;
  nutriments?: Record<string, unknown>;
  nova_group?: number;
  additives_tags?: string[];
  quantity?: string;
  categories?: string;
  nutrition_grades?: string;
  nutriscore_grade?: string;
  ecoscore_grade?: string;
  allergens?: string;
  traces?: string;
  countries?: string;
  completeness?: number;
};

type ProductMatch = { product: Product; source: string; matchedCode: string };

// In-memory cache to prevent burning API quota on identical searches
const scanCache = new Map<string, { data: Analysis; expiresAt: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

// Store the resolved model name so we don't query the model list repeatedly
let activeModelName: string | null = null;

const SYSTEM_PROMPT = `You are a careful, evidence-led food-health analyst. Grade a food for everyday health using verified package or database evidence first.

Grading scale: A = whole/minimally processed and genuinely healthy; B = decent with minor issues; C = average, best occasionally; D = poor; E = very poor ultra-processed food; F = exceptionally harmful formulation.

Accuracy rules:
- Never invent an ingredient, nutrient amount, brand, or product identity.
- Treat database and visible-label facts as verified; clearly call missing information "not available".
- When evidence is sparse, explain the category-level estimate and set confidence to low.
- Consider ingredient order, added sugars, sodium, saturated/trans fat, fibre, protein, processing (NOVA), additives, serving size, and likely consumption pattern. Do not grade from one nutrient alone.
- Do not present a Nutri-Score from the database as this app's final grade; independently assess the full evidence.
- Give practical, product/category-specific alternatives.

Return ONLY valid JSON, without markdown, in this exact shape:
{"foodName":string,"brand":string|null,"grade":"A"|"B"|"C"|"D"|"E"|"F","score":number,"verdict":string,"explanation":string,"ingredients":[{"name":string,"concern":string,"severity":"low"|"medium"|"high"}],"nutrition":[{"label":string,"value":string,"note":string}],"goodPoints":[string],"alternatives":[{"name":string,"why":string}],"confidence":"low"|"medium"|"high"}

The explanation must be two plain-language paragraphs: what the evidence shows; then why the relevant components matter for health and who should limit or avoid it.`;

function barcodeVariants(value: string): string[] {
  const digits = value.replace(/\D/g, "");
  const variants = new Set<string>();
  if (digits) variants.add(digits);
  if (digits.length === 12) variants.add(`0${digits}`);
  if (digits.length === 13 && digits.startsWith("0")) variants.add(digits.slice(1));
  if (digits.length === 8) variants.add(`00000${digits}`);
  return [...variants];
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "NutriGrade/1.1 (https://healthy-plate-scanner.vercel.app)" },
      signal: AbortSignal.timeout(6500),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function lookupOpenFoodFacts(code: string): Promise<Product | null> {
  const fields = [
    "product_name",
    "brands",
    "ingredients_text",
    "nutriments",
    "nova_group",
    "additives_tags",
    "quantity",
    "categories",
    "nutrition_grades",
    "nutriscore_grade",
    "ecoscore_grade",
    "allergens",
    "traces",
    "countries",
    "completeness",
  ].join(",");
  const urls = [
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${fields}`,
    `https://api.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${fields}`,
    `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`,
  ];
  for (const url of urls) {
    const json = (await fetchJson(url)) as { status?: number; product?: Product } | null;
    if (json?.product && json.status !== 0) return json.product;
  }
  return null;
}

async function lookupUpcItemDb(code: string): Promise<Product | null> {
  const json = (await fetchJson(
    `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`,
  )) as { items?: Array<{ title?: string; brand?: string; description?: string; category?: string; size?: string }> } | null;
  const item = json?.items?.[0];
  if (!item) return null;
  return {
    product_name: item.title,
    brands: item.brand,
    ingredients_text: item.description,
    categories: item.category,
    quantity: item.size,
  };
}

async function lookupBarcode(value: string): Promise<ProductMatch | null> {
  const variants = barcodeVariants(value);
  for (const code of variants) {
    const product = await lookupOpenFoodFacts(code);
    if (product) return { product, source: "Open Food Facts", matchedCode: code };
  }
  for (const code of variants) {
    const product = await lookupUpcItemDb(code);
    if (product) return { product, source: "UPCitemdb", matchedCode: code };
  }
  return null;
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("The analysis response was incomplete. Please try again.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeAnalysis(value: unknown, input: AnalysisInput, match: ProductMatch | null): Analysis {
  const parsed = value && typeof value === "object" ? (value as Partial<Analysis>) : {};
  const grades = ["A", "B", "C", "D", "E", "F"] as const;
  const grade = grades.includes(parsed.grade as (typeof grades)[number]) ? (parsed.grade as Analysis["grade"]) : "C";
  const confidence = ["low", "medium", "high"].includes(parsed.confidence ?? "")
    ? (parsed.confidence as Analysis["confidence"])
    : match
      ? "medium"
      : "low";
  return {
    foodName:
      typeof parsed.foodName === "string" && parsed.foodName.trim()
        ? parsed.foodName
        : match?.product.product_name ?? input.name ?? "Unknown food",
    brand: typeof parsed.brand === "string" ? parsed.brand : match?.product.brands ?? null,
    barcode: input.barcode?.replace(/\D/g, "") || null,
    grade,
    score: Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 50))),
    verdict: typeof parsed.verdict === "string" ? parsed.verdict : "There is not enough evidence for a precise verdict.",
    explanation:
      typeof parsed.explanation === "string"
        ? parsed.explanation
        : "Product details were limited, so this assessment is an estimate. Photograph the ingredients and nutrition label for a more accurate result.",
    ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients.slice(0, 12) : [],
    nutrition: Array.isArray(parsed.nutrition) ? parsed.nutrition.slice(0, 12) : [],
    goodPoints: strings(parsed.goodPoints).slice(0, 8),
    alternatives: Array.isArray(parsed.alternatives) ? parsed.alternatives.slice(0, 5) : [],
    confidence,
  };
}

// Automatically inspects the models endpoint to find the exact model enabled on this API Key
async function resolveWorkingModel(apiKey: string): Promise<string> {
  if (activeModelName) return activeModelName;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (res.ok) {
      const data = (await res.json()) as {
        models?: Array<{ name: string; supportedGenerationMethods?: string[] }>;
      };
      const valid = (data.models || []).filter((m) =>
        m.supportedGenerationMethods?.includes("generateContent"),
      );

      // Look for any flash model first
      const flash = valid.find((m) => m.name.toLowerCase().includes("flash"));
      if (flash) {
        activeModelName = flash.name.replace(/^models\//, "");
        return activeModelName;
      }

      if (valid.length > 0) {
        activeModelName = valid[0].name.replace(/^models\//, "");
        return activeModelName;
      }
    }
  } catch (e) {
    console.error("Failed to query models list dynamically:", e);
  }

  // Fallback defaults if discovery failed
  return "gemini-2.0-flash";
}

export async function performFoodAnalysis(data: AnalysisInput, apiKey: string): Promise<Analysis> {
  // Check Cache first
  const cacheKey = data.barcode?.replace(/\D/g, "") || (data.name ? data.name.trim().toLowerCase() : null);
  if (cacheKey && !data.imageBase64) {
    const cachedItem = scanCache.get(cacheKey);
    if (cachedItem && cachedItem.expiresAt > Date.now()) {
      return cachedItem.data;
    }
  }

  const match = data.barcode ? await lookupBarcode(data.barcode) : null;
  const product = match?.product;
  const evidence = match
    ? `VERIFIED PRODUCT DATABASE MATCH (${match.source}; matched barcode ${match.matchedCode}):
name: ${product?.product_name ?? "not available"}
brand: ${product?.brands ?? "not available"}
quantity: ${product?.quantity ?? "not available"}
categories: ${product?.categories ?? "not available"}
ingredients: ${product?.ingredients_text ?? "not available"}
allergens: ${product?.allergens ?? "not available"}; traces: ${product?.traces ?? "not available"}
NOVA processing group: ${product?.nova_group ?? "not available"}
database nutrition grade: ${product?.nutrition_grades ?? product?.nutriscore_grade ?? "not available"}
additives: ${(product?.additives_tags ?? []).join(", ") || "none listed"}
nutriments per 100g: ${JSON.stringify(product?.nutriments ?? {}).slice(0, 3500)}
record completeness: ${product?.completeness ?? "not available"}`
    : data.barcode
      ? `Barcode ${data.barcode.replace(/\D/g, "")} was not found in either product database. Do not guess its identity. Use only a supplied name or visible label; otherwise identify it as an unknown product and set confidence low.`
      : "";

  const promptText = [
    data.name ? `User-provided food name: ${data.name}` : "",
    evidence,
    data.imageBase64 ? "A current package/ingredients/nutrition photo is attached. Read visible text carefully and prefer it over conflicting database data." : "",
    "Analyse the evidence and return the required JSON.",
  ].filter(Boolean).join("\n\n");

  const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [
    { text: promptText },
  ];

  if (data.imageBase64) {
    const mimeMatch = data.imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const base64Data = data.imageBase64.includes(",")
      ? data.imageBase64.split(",")[1]
      : data.imageBase64;

    parts.push({
      inline_data: {
        mime_type: mimeType,
        data: base64Data,
      },
    });
  }

  const modelToUse = await resolveWorkingModel(apiKey);

  let rawText = "";
  let lastErrorText = "";

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: SYSTEM_PROMPT }],
            },
            contents: [{ parts }],
            generationConfig: {
              response_mime_type: "application/json",
            },
          }),
        }
      );

      if (response.status === 429) {
        lastErrorText = "Rate limit reached. Backing off...";
        await new Promise((res) => setTimeout(res, 1500));
        continue;
      }

      if (!response.ok) {
        lastErrorText = await response.text();
        break;
      }

      const json = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      rawText = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (rawText) break;
    } catch (err) {
      lastErrorText = err instanceof Error ? err.message : String(err);
      await new Promise((res) => setTimeout(res, 1000));
    }
  }

  if (!rawText) {
    throw new Error(
      lastErrorText
        ? `Analysis service error: ${lastErrorText.slice(0, 180)}`
        : "Traffic is currently high. Please try again in a few seconds."
    );
  }

  const analysisResult = normalizeAnalysis(extractJson(rawText), data, match);

  // Cache successful result
  if (cacheKey && !data.imageBase64) {
    scanCache.set(cacheKey, {
      data: analysisResult,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  return analysisResult;
}
