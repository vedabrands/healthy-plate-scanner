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

const SYSTEM_PROMPT = `You are a careful, evidence-led food-health analyst. Grade a food for everyday health using verified package or database evidence first.

Grading scale: A = whole/minimally processed and genuinely healthy; B = decent with minor issues; C = average, best occasionally; D = poor; E = very poor ultra-processed food; F = exceptionally ha[...]

Accuracy rules:
- Never invent an ingredient, nutrient amount, brand, or product identity.
- Treat database and visible-label facts as verified; clearly call missing information "not available".
- When evidence is sparse, explain the category-level estimate and set confidence to low.
- Consider ingredient order, added sugars, sodium, saturated/trans fat, fibre, protein, processing (NOVA), additives, serving size, and likely consumption pattern. Do not grade from one nutrient alone[...]
- Do not present a Nutri-Score from the database as this app's final grade; independently assess the full evidence.
- Give practical, product/category-specific alternatives.

Return ONLY valid JSON, without markdown, in this exact shape:
{"foodName":string,"brand":string|null,"grade":"A"|"B"|"C"|"D"|"E"|"F","score":number,"verdict":string,"explanation":string,"ingredients":[{"name":string,"concern":string,"severity":"low"|"medium"|"hi[...]

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
      headers: { "User-Agent": "NutriGrade/1.1 (food analysis app)" },
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

// --- New: dynamic model discovery + cache + rate-limit handling + scan cache ---

type CachedEntry = {
  expires: number;
  promise: Promise<Analysis>;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const scanCache = new Map<string, CachedEntry>();

function getCacheKeyForInput(data: AnalysisInput): string | null {
  if (data.barcode) {
    const digits = data.barcode.replace(/\D/g, "");
    if (digits) return `barcode:${digits}`;
  }
  if (data.name && data.name.trim()) {
    return `name:${data.name.trim().toLowerCase()}`;
  }
  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Cache the resolved model name once per process
let resolvedModelName: string | null = null;
let resolvingModelPromise: Promise<string> | null = null;

function shortModelName(rawName: unknown): string | null {
  if (!rawName) return null;
  const s = String(rawName);
  // if the name contains slashes (projects/.../models/xyz or models/xyz), return last segment
  const parts = s.split("/");
  return parts.length ? parts[parts.length - 1] : s;
}

async function resolveGeminiModel(apiKey: string): Promise<string> {
  if (resolvedModelName) return resolvedModelName;
  if (resolvingModelPromise) return resolvingModelPromise;

  resolvingModelPromise = (async () => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    try {
      const res = await fetch(url, { method: "GET", headers: { "Content-Type": "application/json" } });
      if (!res.ok) throw new Error(`Failed to list models: ${res.status}`);
      const json = await res.json();
      const models = Array.isArray(json?.models) ? json.models : [];

      // Helper to stringify model for capability checks
      const modelText = (m: any) => JSON.stringify(m || {}).toLowerCase();

      // Prefer models that include 'flash' in the name and support generateContent
      const flashWithGenerate = models.find((m: any) => {
        const name: string = shortModelName(m?.name) ?? "";
        return /flash/i.test(name) && modelText(m).includes("generatecontent");
      });
      if (flashWithGenerate?.name) {
        resolvedModelName = shortModelName(flashWithGenerate.name) as string;
        return resolvedModelName;
      }

      // Next, any model that supports generateContent
      const anyGenerate = models.find((m: any) => modelText(m).includes("generatecontent") && typeof m?.name === "string");
      if (anyGenerate?.name) {
        resolvedModelName = shortModelName(anyGenerate.name) as string;
        return resolvedModelName;
      }

      // Fallback: pick first model with 'flash' in the name
      const flashModel = models.find((m: any) => /flash/i.test(String(m?.name ?? "")));
      if (flashModel?.name) {
        resolvedModelName = shortModelName(flashModel.name) as string;
        return resolvedModelName;
      }

      // Final fallback: pick first model that appears to be a text model
      const textModel = models.find((m: any) => modelText(m).includes("text") && typeof m?.name === "string");
      if (textModel?.name) {
        resolvedModelName = shortModelName(textModel.name) as string;
        return resolvedModelName;
      }

      throw new Error("No suitable Gemini model found for this API key.");
    } finally {
      resolvingModelPromise = null;
    }
  })();

  return resolvingModelPromise;
}

async function callGemini(apiKey: string, requestBody: unknown): Promise<any> {
  // Resolve model (cached)
  let model = await resolveGeminiModel(apiKey);
  const maxRetries = 4; // retry on 429 up to this many times
  const backoffMs = 1500;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
    } catch (err) {
      // Network error - retry after backoff
      if (attempt < maxRetries - 1) {
        await sleep(backoffMs);
        continue;
      }
      throw err;
    }

    if (response.status === 404) {
      // Model not found for this API key - invalidate cached resolved model and try to re-resolve once
      resolvedModelName = null;
      try {
        model = await resolveGeminiModel(apiKey);
        // retry immediately with new model (counts toward attempts)
        if (attempt < maxRetries - 1) continue;
      } catch (err) {
        // If we can't resolve a model, throw
        throw new Error(`Model resolution failed after 404: ${(err as Error).message}`);
      }
    }

    if (response.status === 429) {
      // Rate limited - backoff and retry
      if (attempt < maxRetries - 1) {
        await sleep(backoffMs);
        continue;
      }
      const errorText = await response.text();
      throw new Error(`Gemini rate limit (429): ${errorText}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API Error (${response.status}): ${errorText.slice(0, 180)}`);
    }

    // success
    return response.json();
  }

  throw new Error("Gemini call failed after retries");
}

export async function performFoodAnalysis(data: AnalysisInput, apiKey: string): Promise<Analysis> {
  const cacheKey = getCacheKeyForInput(data);
  const now = Date.now();

  if (cacheKey) {
    const existing = scanCache.get(cacheKey);
    if (existing && existing.expires > now) {
      try {
        return await existing.promise;
      } catch {
        scanCache.delete(cacheKey);
      }
    }
  }

  const computePromise = (async (): Promise<Analysis> => {
    const match = data.barcode ? await lookupBarcode(data.barcode) : null;
    const product = match?.product;
    const evidence = match
      ? `VERIFIED PRODUCT DATABASE MATCH (${match.source}; matched barcode ${match.matchedCode}):\nname: ${product?.product_name ?? "not available"}\nbrand: ${product?.brands ?? "not available"}\nquantity: ${product?.quantity ?? "not available"}\ncategories: ${product?.categories ?? "not available"}\ningredients: ${product?.ingredients_text ?? "not available"}\nallergens: ${product?.allergens ?? "not available"}; traces: ${product?.traces ?? "not available"}\nNOVA processing group: ${product?.nova_group ?? "not available"}\ndatabase nutrition grade: ${product?.nutrition_grades ?? product?.nutriscore_grade ?? "not available"}\nadditives: ${(product?.additives_tags ?? []).join(", ") || "none listed"}\nnutriments per 100g: ${JSON.stringify(product?.nutriments ?? {}).slice(0, 3500)}\nrecord completeness: ${product?.completeness ?? "not available"}`
      : data.barcode
        ? `Barcode ${data.barcode.replace(/\D/g, "")} was not found in either product database. Do not guess its identity. Use only a supplied name or visible label; otherwise identify it as an unknown [...]`
        : "";

    const promptText = [
      data.name ? `User-provided food name: ${data.name}` : "",
      evidence,
      data.imageBase64 ? "A current package/ingredients/nutrition photo is attached. Read visible text carefully and prefer it over conflicting database data." : "",
      "Analyse the evidence and return the required JSON.",
    ].filter(Boolean).join("\n\n");

    const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [
      { text: promptText }
    ];

    if (data.imageBase64) {
      const mimeMatch = data.imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
      const base64Data = data.imageBase64.includes(",")
        ? data.imageBase64.split(",")[1]
        : data.imageBase64;

      parts.push({ inline_data: { mime_type: mimeType, data: base64Data } });
    }

    const requestBody = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts }],
      generationConfig: { response_mime_type: "application/json" },
    };

    const json = await callGemini(apiKey, requestBody);

    const rawText = (json as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = extractJson(rawText);
    return normalizeAnalysis(parsed, data, match);
  })();

  if (cacheKey) {
    scanCache.set(cacheKey, { promise: computePromise, expires: now + CACHE_TTL_MS });
    // cleanup expired
    for (const [k, v] of scanCache.entries()) if (v.expires <= Date.now()) scanCache.delete(k);
  }

  try {
    const result = await computePromise;
    return result;
  } catch (err) {
    if (cacheKey) scanCache.delete(cacheKey);
    throw err;
  }
}
