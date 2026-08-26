// Replace existing resolveGeminiModel and callGemini with this robust logic:

const MODEL_BLACKLIST = new Set([
  "gemini-2.5-flash",
  "gemini-2.5-flash-001",
  "gemini-1.5-flash", // raw
  // add other known-deprecated names here if needed
]);

function sanitizeModelId(rawName: unknown): string | null {
  if (!rawName) return null;
  const s = String(rawName).trim();
  const parts = s.split("/");
  const candidate = parts[parts.length - 1];
  if (/^[A-Za-z0-9_.-]+$/.test(candidate)) return candidate;
  return null;
}

async function resolveGeminiModel(apiKey: string): Promise<{ id: string; raw: string }> {
  if (resolvedModelName) return { id: resolvedModelName, raw: resolvedModelName };
  if (resolvingModelPromise) return resolvingModelPromise;

  resolvingModelPromise = (async (): Promise<{ id: string; raw: string }> => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, { method: "GET", headers: { "Content-Type": "application/json" } });
    if (!res.ok) throw new Error(`Failed to list Gemini models (${res.status})`);
    const body = await res.json();
    const models = Array.isArray(body?.models) ? body.models : [];

    const modelText = (m: any) => JSON.stringify(m || "").toLowerCase();

    // Build prioritized list:
    const candidates: any[] = [];

    // 1) flash + generateContent, not blacklisted
    for (const m of models) {
      const raw = String(m?.name ?? "");
      const id = sanitizeModelId(raw) ?? raw;
      if (/flash/i.test(raw) && modelText(m).includes("generatecontent") && !MODEL_BLACKLIST.has(id)) {
        candidates.push(m);
      }
    }
    // 2) any generateContent (non-blacklisted)
    for (const m of models) {
      const raw = String(m?.name ?? "");
      const id = sanitizeModelId(raw) ?? raw;
      if (modelText(m).includes("generatecontent") && !MODEL_BLACKLIST.has(id) && !candidates.includes(m)) {
        candidates.push(m);
      }
    }
    // 3) flash models (non-blacklisted)
    for (const m of models) {
      const raw = String(m?.name ?? "");
      const id = sanitizeModelId(raw) ?? raw;
      if (/flash/i.test(raw) && !MODEL_BLACKLIST.has(id) && !candidates.includes(m)) {
        candidates.push(m);
      }
    }
    // 4) generic text-like
    for (const m of models) {
      const raw = String(m?.name ?? "");
      const id = sanitizeModelId(raw) ?? raw;
      if (modelText(m).includes("text") && !MODEL_BLACKLIST.has(id) && !candidates.includes(m)) {
        candidates.push(m);
      }
    }

    for (const m of candidates) {
      const raw = String(m?.name ?? "");
      const id = sanitizeModelId(raw) ?? raw;
      if (id && !MODEL_BLACKLIST.has(id)) {
        resolvedModelName = id;
        return { id, raw };
      }
      if (raw && !MODEL_BLACKLIST.has(raw)) {
        // fallback to raw (not ideal but keep it)
        return { id: raw, raw };
      }
    }

    throw new Error("No suitable Gemini model found for this API key.");
  })();

  try {
    return await resolvingModelPromise;
  } finally {
    resolvingModelPromise = null;
  }
}

/**
 * callGemini: tries sanitized id; on 400 about model format will try raw suggestion fallback;
 * on 404 may parse suggested model name from message and retry; on 429 retries with backoff.
 */
async function callGemini(apiKey: string, requestBody: unknown): Promise<any> {
  const maxRetries = 4;
  const backoffMs = 1500;

  // Resolve model info (sanitized id + raw name)
  const modelInfo = await resolveGeminiModel(apiKey);
  let modelId = modelInfo.id;
  const rawName = modelInfo.raw;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
    } catch (err) {
      if (attempt < maxRetries - 1) {
        await sleep(backoffMs);
        continue;
      }
      throw err;
    }

    // handle 429 (rate limit)
    if (response.status === 429) {
      if (attempt < maxRetries - 1) {
        await sleep(backoffMs);
        continue;
      }
      const t = await response.text();
      throw new Error(`Gemini rate limit (429): ${t}`);
    }

    // handle 404: server may say a model is no longer available and recommend another
    if (response.status === 404) {
      const txt = await response.text();
      // try to extract suggested model like "use models/gemini-3.6-flash"
      const m = txt.match(/use\s+models\/([A-Za-z0-9_.-]+)/i) || txt.match(/use\s+([A-Za-z0-9_.-]+-flash)/i);
      if (m && m[1]) {
        const suggested = m[1];
        // if blacklisted skip; else use suggested
        if (!MODEL_BLACKLIST.has(suggested)) {
          modelId = suggested;
          // update cached resolved model so future calls use it
          resolvedModelName = suggested;
          // try immediately (counts as next attempt)
          if (attempt < maxRetries - 1) continue;
        }
      }
      // Invalidate resolved model and re-resolve on next iteration
      resolvedModelName = null;
      if (attempt < maxRetries - 1) {
        await sleep(backoffMs);
        // re-resolve (will pick next available)
        const info = await resolveGeminiModel(apiKey);
        modelId = info.id;
        continue;
      }
      throw new Error(`Gemini 404: ${txt}`);
    }

    // handle 400 model-format errors which mention "unexpected model name format"
    if (response.status === 400) {
      const bodyText = await response.text();
      if (bodyText.toLowerCase().includes("unexpected model name format") || bodyText.toLowerCase().includes("invalid_argument")) {
        // try rawName fallback once if different from modelId and not blacklisted
        if (rawName && rawName !== modelId && !MODEL_BLACKLIST.has(rawName)) {
          const rawUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(rawName)}:generateContent?key=${encodeURIComponent(apiKey)}`;
          const rawResp = await fetch(rawUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
          });
          if (rawResp.ok) return rawResp.json();
          // if raw attempt fails with 404, invalidate and re-resolve
          if (rawResp.status === 404) {
            resolvedModelName = null;
          }
          const rawTxt = await rawResp.text();
          if (attempt < maxRetries - 1) {
            await sleep(backoffMs);
            const info = await resolveGeminiModel(apiKey);
            modelId = info.id;
            continue;
          }
          throw new Error(`Gemini model-format fallback failed: ${rawResp.status} ${rawTxt}`);
        }
      }
      // otherwise surface the 400
      throw new Error(`Gemini API (400): ${bodyText}`);
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API Error (${response.status}): ${errText.slice(0, 180)}`);
    }

    // success
    return response.json();
  }

  throw new Error("Gemini call failed after retries");
}
