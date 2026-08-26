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

Grading scale: A = whole/minimally processed and genuinely healthy; B = decent with minor issues; C = average, best occasionally; D = poor; E = very poor ultra-processed food; F = exceptionally harmfu[...]

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

/*
  New features:
  - scanCache: in-memory Map keyed by barcode digits or normalized food name with 24h TTL.
  - callGemini: tries a list of non-deprecated models (gemini-2.0-flash then fallbacks) and retries on 429 with 1.5s backoff.
  - performFoodAnalysis uses cache to avoid repeated Gemini calls for identical scans.
*/

type CachedEntry = {
  expires: number;
  promise: Promise<Analysis>;
};

// 24 hours TTL
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
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

async function callGeminiWithFallback(apiKey: string, requestBody: unknown) {
  // Models to try in order. Do NOT include gemini-2.5-flash or gemini-1.5-flash (raw).
  const models = ["gemini-2.0-flash", "gemini-2.0-flash-001", "gemini-1.5-flash-latest"];
  const max429Retries = 4; // attempt up to this many times when receiving 429 (including first attempt)
  const backoffMs = 1500; // 1.5s backoff per requirement

  let lastError: Error | null = null;

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    let attempt = 0;
    while (true) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        if (response.status === 404) {
          // This model isn't available on this endpoint — try next model
          lastError = new Error(`Model ${model} returned 404 (not found)`);
          break; // break the retry loop and try next model
        }

        if (response.status === 429) {
          attempt++;
          lastError = new Error(`Gemini 429 rate limit for model ${model}`);
          if (attempt < max429Retries) {
            // wait and retry
            await sleep(backoffMs);
            continue;
          } else {
            // exhausted retries for this model; try next model after recording lastError
            break;
          }
        }

        // For other non-OK responses, capture and throw (we don't retry other statuses here)
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Gemini API Error (${response.status}): ${errorText.slice(0, 180)}`);
        }

        // Successful response
        const json = await response.json();
        return json;
      } catch (err) {
        // Network or thrown error: if it looks like a transient 429 or network error, retry per attempt limits
        // If this was due to an early thrown 429 exhaustion, break and try next model.
        const message = (err instanceof Error && err.message) ? err.message : String(err);
        // If message contains 429 or rate limit, we've already handled attempts; break to try next model.
        if (message.includes("429") || message.toLowerCase().includes("rate limit")) {
          // if we've exhausted attempts for this model, break inner loop to try the next model
          break;
        }
        // For other errors, don't try fallback models immediately — set lastError and break
        lastError = err instanceof Error ? err : new Error(String(err));
        break;
      }
    } // retry loop
    // try next model
  } // models loop

  throw lastError ?? new Error("No supported Gemini model available (tried gemini-2.0-flash family and gemini-1.5-flash-latest).");
}

export async function performFoodAnalysis(data: AnalysisInput, apiKey: string): Promise<Analysis> {
  // Use cache key only if barcode or name provided per requirements
  const cacheKey = getCacheKeyForInput(data);
  const now = Date.now();

  if (cacheKey) {
    const entry = scanCache.get(cacheKey);
    if (entry && entry.expires > now) {
      try {
        return await entry.promise;
      } catch {
        // If a previous cached attempt failed, remove it to allow fresh retry
        scanCache.delete(cacheKey);
      }
    }
  }

  // computePromise wraps the analysis pipeline and will be stored in the cache immediately
  const computePromise = (async (): Promise<Analysis> => {
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

      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: base64Data,
        },
      });
    }

    const requestBody = {
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          parts,
        },
      ],
      generationConfig: {
        response_mime_type: "application/json",
      },
    };

    // callGeminiWithFallback will try models in order and handle 429 retries/backoff
    const json = await callGeminiWithFallback(apiKey, requestBody);

    const rawText = (json as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = extractJson(rawText);
    return normalizeAnalysis(parsed, data, match);
  })();

  if (cacheKey) {
    // store in cache
    scanCache.set(cacheKey, { promise: computePromise, expires: now + CACHE_TTL_MS });
    // cleanup expired entries opportunistically (cheap)
    for (const [k, v] of scanCache.entries()) {
      if (v.expires <= Date.now()) scanCache.delete(k);
    }
  }

  try {
    const result = await computePromise;
    return result;
  } catch (err) {
    // If cached, remove failed entry so future attempts can retry
    if (cacheKey) scanCache.delete(cacheKey);
    throw err;
  }
}
