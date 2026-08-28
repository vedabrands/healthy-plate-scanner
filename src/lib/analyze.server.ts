import { supabase } from "@/integrations/supabase/client";
import type { Analysis, AnalysisInput } from "./analyze.types";

// ... [Keep existing types, SYSTEM_PROMPT, lookupBarcode, lookupOpenFoodFacts, etc.] ...

export async function performFoodAnalysis(data: AnalysisInput, apiKey: string): Promise<Analysis> {
  const cleanBarcode = data.barcode?.replace(/\D/g, "");
  const cleanName = data.name?.trim().toLowerCase();
  const searchKey = cleanBarcode || cleanName;

  // 1. Check Global Supabase Cache First (Skip API entirely if found)
  if (searchKey && !data.imageBase64) {
    try {
      const { data: cachedRow } = await supabase
        .from("food_cache")
        .select("data")
        .eq("search_key", searchKey)
        .maybeSingle();

      if (cachedRow?.data) {
        return cachedRow.data as unknown as Analysis;
      }
    } catch (err) {
      console.warn("Cache read bypass:", err);
    }
  }

  // 2. Database barcode lookup for verified packaging evidence
  const match = cleanBarcode ? await lookupBarcode(cleanBarcode) : null;
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
    : cleanBarcode
      ? `Barcode ${cleanBarcode} was not found in either product database. Do not guess its identity. Use only a supplied name or visible label; otherwise identify it as an unknown product and set confidence low.`
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

  // 3. Request Gemini API (gemini-3.6-flash)
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
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

  if (!response.ok) {
    const errBody = await response.text();
    if (response.status === 429) {
      throw new Error("High traffic — rate limit reached. Please retry in a few moments.");
    }
    throw new Error(`Analysis service error (${response.status}): ${errBody.slice(0, 160)}`);
  }

  const json = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const analysisResult = normalizeAnalysis(extractJson(rawText), data, match);

  // 4. Save newly graded item into Supabase for all future users
  if (searchKey && !data.imageBase64) {
    void supabase
      .from("food_cache")
      .upsert(
        {
          search_key: searchKey,
          barcode: cleanBarcode || null,
          food_name: analysisResult.foodName,
          data: analysisResult as unknown as Record<string, unknown>,
        },
        { onConflict: "search_key" }
      )
      .then();
  }

  return analysisResult;
}
