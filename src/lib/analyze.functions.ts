import { createServerFn } from "@tanstack/react-start";
import type { Analysis, AnalysisInput } from "./analyze.types";

export type { Analysis, AnalysisInput } from "./analyze.types";

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
    const { performFoodAnalysis } = await import("./analyze.server");
    return performFoodAnalysis(data, apiKey);
  });
