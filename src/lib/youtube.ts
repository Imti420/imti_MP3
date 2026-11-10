const ID_RE = /^[a-zA-Z0-9_-]{11}$/;

export type ParsedVideo = {
  id: string;
  canonical: string;
};

function cleanId(value: string): string | null {
  const id = value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 11);
  return ID_RE.test(id) ? id : null;
}

/** Accepts watch, shorts, embed, live, music, youtu.be, or a bare 11-character id. */
export function parseYouTube(raw: string): ParsedVideo | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (ID_RE.test(trimmed)) {
    return { id: trimmed, canonical: `https://www.youtube.com/watch?v=${trimmed}` };
  }

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const allowed =
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com" ||
    host === "youtube-nocookie.com" ||
    host === "youtu.be";
  if (!allowed) return null;

  let id: string | null = null;
  if (host === "youtu.be") {
    id = cleanId(url.pathname.split("/").filter(Boolean)[0] ?? "");
  } else {
    const parts = url.pathname.split("/").filter(Boolean);
    const head = parts[0] ?? "";
    if (head === "shorts" || head === "embed" || head === "live" || head === "v") {
      id = cleanId(parts[1] ?? "");
    } else {
      id = cleanId(url.searchParams.get("v") ?? "");
    }
  }

  if (!id) return null;
  return { id, canonical: `https://www.youtube.com/watch?v=${id}` };
}
