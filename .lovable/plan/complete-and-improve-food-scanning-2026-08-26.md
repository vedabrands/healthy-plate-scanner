# Complete and improve food scanning

## What will change
- Finish the pending setup: switch food analysis to the required high-accuracy AI model and mount app notifications.
- Replace browser-only barcode detection with a cross-browser scanning library that supports common retail formats and continues scanning frames until it gets a reliable result.
- Normalize UPC/EAN variants before lookup, retry equivalent codes (including UPC-A/EAN-13 leading-zero forms), and validate check digits to reduce false scans.
- Expand barcode coverage with multiple Open Food Facts regional/global API strategies and a text-search fallback when an exact code is unavailable.
- Make analysis more accurate by grounding it in all available product fields, explicitly distinguishing verified label data from estimates, and validating/clamping the AI response before display.
- Improve camera feedback and let users capture a label/photo when no barcode match is available.

## Technical details
- Add a browser-compatible barcode decoder package; load/use it only in the scanner UI.
- Keep external product lookups and AI calls inside the existing TanStack server function boundary.
- Split runtime helpers and prompts out of the `createServerFn` module so the wrapper remains deployment-safe.
- Use `openai/gpt-5.6-sol` and structured JSON output instructions without unsupported token options.
- Verify build output, camera/manual barcode flows, and one real known barcode lookup in the live app.

## Scope note
No barcode database contains every product. The improved flow will search substantially more reliably and will fall back to label-photo analysis when a product is genuinely absent.
