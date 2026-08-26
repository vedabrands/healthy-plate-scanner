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