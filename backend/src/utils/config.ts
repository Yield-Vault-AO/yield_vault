export function parseHeadersConfig(rawValue: string): Record<string, string> {
  let value = rawValue.trim();
  // Strip one layer of surrounding quotes if present
  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    value = value.slice(1, -1);
  }

  const candidates: string[] = [];
  candidates.push(value);
  // URL-decoded
  try {
    candidates.push(decodeURIComponent(value));
  } catch {}
  // Base64-decoded
  try {
    // atob is available in Bun/DOM
    // @ts-ignore
    const decoded = typeof atob === 'function' ? atob(value) : value;
    candidates.push(decoded);
  } catch {}
  // Replace common escape sequences
  candidates.push(value.replace(/\\\"/g, '"'));
  candidates.push(value.replace(/\\\\/g, '\\'));
  candidates.push(value.replace(/\\\\/g, '\\').replace(/\\\"/g, '"'));

  const normalize = (obj: unknown): Record<string, string> | null => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v;
    }
    return out;
  };

  const peelStringJson = (text: string): unknown => {
    // Try up to 4 peels in case it's a JSON string of a JSON string...
    let current: unknown = text;
    for (let i = 0; i < 4; i++) {
      if (typeof current !== 'string') return current;
      const parsed = JSON.parse(current);
      if (typeof parsed === 'string') {
        current = parsed;
      } else {
        return parsed;
      }
    }
    return current;
  };

  for (const cand of candidates) {
    try {
      // Direct parse
      const direct = JSON.parse(cand);
      const norm = normalize(direct);
      if (norm) return norm;
    } catch {}
    try {
      // Treat as a JSON string literal and then parse again
      const wrapped = '"' + cand.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
      const asString: string = JSON.parse(wrapped);
      const peeled = peelStringJson(asString);
      const norm = normalize(peeled);
      if (norm) return norm;
    } catch {}
  }

  throw new Error('Invalid HEADERS_JSON format');
}
