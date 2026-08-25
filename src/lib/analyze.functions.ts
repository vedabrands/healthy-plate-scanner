import { createServerFn } from "@tanstack/react-start";

export type AnalysisInput = {
  name?: string;
  barcode?: string;
  imageBase64?: string;
};

export type Analysis = {
  foodName: string;
  brand: string | null;
  barcode: string | null;
  grade: "A" | "B" | "C" | "D" | "E" | "F";
  score: number;
  verdict: string;
  explanation: string;
  ingredients: { name: string; concern: string; severity: "low" | "medium" | "high" }[];
  nutrition: { label: string; value: string; note?: string }[];
  goodPoints: string[];
  alternatives: { name: string; why: string }[];
  confidence: "low" | "medium" | "high";
};

const SYSTEM_PROMPT = `You are a strict but fair food-health analyst.
Given a food product (by name, barcode data, or a photo of the pack/label), grade it for everyday human health.

Grading scale:
A = whole/minimally processed, genuinely healthy
B = decent, minor issues
C = average, eat occasionally
D = poor, clearly unhealthy
E = very poor, ultra-processed junk
F = worst, avoid

Reply with ONLY valid JSON (no markdown fences) in this exact shape:
{
  "foodName": string,
  "brand": string|null,
  "grade": "A"|"B"|"C"|"D"|"E"|"F",
  "score": number,            // 0-100 health score
  "verdict": string,          // one punchy sentence
  "explanation": string,      // 2 detailed paragraphs: what it contains, exactly what is harmful inside it and why it harms the body (sugar load, refined oils, sodium, additives, emulsifiers, colours, preservatives, trans fats), and who should avoid it. Plain, concrete language.
  "ingredients": [ { "name": string, "concern": string, "severity": "low"|"medium"|"high" } ],
  "nutrition": [ { "label": string, "value": string, "note": string } ],
  "goodPoints": [ string ],
  "alternatives": [ { "name": string, "why": string } ],   // 3-5 realistic healthier swaps
  "confidence": "low"|"medium"|"high"
}
If the product is unknown, still reason from the name/category and set confidence "low".`;

type OffProduct = {
  product_name?: string;
  brands?: string;
  ingredients_text?: string;
  nutriments?: Record<string, unknown>;
  nova_group?: number;
  additives_tags?: string[];
  quantity?: string;
  categories?: string;
};

async function lookupBarcode(barcode: string): Promise<OffProduct | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
      { headers: { "User-Agent": "NutriScan/1.0 (lovable app)" } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { status?: number; product?: OffProduct };
    if (!json.product) return null;
    return json.product;
  } catch {
    return null;
  }
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Model did not return JSON");
  return JSON.parse(cleaned.slice(start, end + 1));
}

export const analyzeFood = createServerFn({ method: "POST" })
  .inputValidator((input: AnalysisInput) => {
    if (!input || (!input.name && !input.barcode && !input.imageBase64)) {
      throw new Error("Provide a food name, a barcode, or a photo.");
    }
    return input;
  })
  .handler(async ({ data }): Promise<Analysis> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project.");

    let context = "";
    let product: OffProduct | null = null;

    if (data.barcode) {
      product = await lookupBarcode(data.barcode.trim());
      if (product) {
        context = `Barcode ${data.barcode} matched this product database entry:
name: ${product.product_name ?? "unknown"}
brand: ${product.brands ?? "unknown"}
quantity: ${product.quantity ?? "unknown"}
categories: ${product.categories ?? "unknown"}
ingredients: ${product.ingredients_text ?? "unknown"}
NOVA processing group: ${product.nova_group ?? "unknown"}
additives: ${(product.additives_tags ?? []).join(", ") || "none listed"}
nutriments per 100g: ${JSON.stringify(product.nutriments ?? {}).slice(0, 1500)}`;
      } else {
        context = `Barcode ${data.barcode} was not found in the open product database. Say so honestly and reason from anything else provided.`;
      }
    }

    const userContent: Array<Record<string, unknown>> = [];
    const textParts = [
      data.name ? `Food the user typed: "${data.name}"` : "",
      context,
      data.imageBase64 ? "A photo of the product/label is attached — read the label carefully." : "",
      "Analyse it and return the JSON.",
    ].filter(Boolean);

    userContent.push({ type: "text", text: textParts.join("\n\n") });
    if (data.imageBase64) {
      userContent.push({ type: "image_url", image_url: { url: data.imageBase64 } });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("Too many scans right now — please try again in a moment.");
      if (res.status === 402) throw new Error("AI credits are exhausted for this app. Please add credits.");
      throw new Error(`Scan failed (${res.status}). ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(content) as Analysis;

    return {
      ...parsed,
      barcode: data.barcode ?? null,
      brand: parsed.brand ?? product?.brands ?? null,
      ingredients: parsed.ingredients ?? [],
      nutrition: parsed.nutrition ?? [],
      goodPoints: parsed.goodPoints ?? [],
      alternatives: parsed.alternatives ?? [],
    };
  });
