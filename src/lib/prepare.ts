import { parseYouTube } from "./youtube";

export type VideoCard = {
  id: string;
  url: string;
  title: string;
  author: string;
  thumbnail: string;
  duration: number | null;
  views: number | null;
};

export type LookupResult =
  | { ok: true; card: VideoCard }
  | { ok: false; error: string };

export type PrepareInput = {
  url: string;
  mode: "video" | "audio";
  quality: "1080" | "720" | "480" | "360";
  bitrate: "128" | "320";
};

export type PrepareResult =
  | {
      ok: true;
      href: string;
      filename: string;
      kind: "mp4" | "mp3";
      ms: number;
      attempts: number;
    }
  | { ok: false; error: string; attempts: number };

/**
 * Public cobalt-compatible API that still serves YouTube without a JWT.
 * Ordered so the last one that answered is tried first on the next request.
 */
const MIRRORS = [
  "https://rue-cobalt.xenon.zone/",
];

const PIPED = [
  "https://api.piped.private.coffee",
  "https://pipedapi.ducks.party",
];

const UA = "Rivet/1.0 (youtube file helper)";

let pinnedMirror = 0;

type CobaltBody = {
  status?: string;
  url?: string;
  filename?: string;
  picker?: { url?: string; type?: string }[];
  error?: { code?: string };
};

class MirrorRefuse extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

function explain(code: string): string {
  const c = code.toLowerCase();
  if (c.includes("rate")) return "Every mirror is busy. Wait a few seconds and try again.";
  if (c.includes("unavailable") || c.includes("private") || c.includes("not_found") || c.includes("content"))
    return "That video is private, deleted, age-gated, or blocked where the mirrors sit.";
  if (c.includes("invalid") || c.includes("unsupported") || c.includes("link"))
    return "That link isn't a public YouTube video.";
  if (c.includes("login") || c.includes("auth") || c.includes("sign"))
    return "YouTube told the mirrors to sign in. Try again in a moment — a different mirror sometimes gets through.";
  if (c.includes("timeout") || c.includes("abort") || c.includes("timed"))
    return "The mirrors took too long. Try a lower quality, or hit Prepare again.";
  return "No mirror could fetch that video. Try again, or step the quality down.";
}

async function readJson(url: string, init: RequestInit, ms: number): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  return { status: res.status, body };
}

async function fetchOembed(canonical: string): Promise<{ title: string; author: string; thumbnail: string } | null> {
  try {
    const { status, body } = await readJson(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(canonical)}`,
      { headers: { Accept: "application/json", "User-Agent": UA } },
      6000,
    );
    if (status !== 200 || !body || typeof body !== "object") return null;
    const row = body as { title?: string; author_name?: string; thumbnail_url?: string };
    return {
      title: row.title?.trim() || "",
      author: row.author_name?.trim() || "",
      thumbnail: row.thumbnail_url || "",
    };
  } catch {
    return null;
  }
}

type PipedMeta = { title: string; author: string; duration: number | null; views: number | null };

async function fetchPipedMeta(id: string): Promise<PipedMeta | null> {
  for (const base of PIPED) {
    try {
      const { status, body } = await readJson(
        `${base}/streams/${id}`,
        { headers: { Accept: "application/json", "User-Agent": UA } },
        3500,
      );
      if (status !== 200 || !body || typeof body !== "object") continue;
      const row = body as {
        title?: string;
        uploader?: string;
        duration?: number;
        views?: number;
        error?: string;
      };
      if (!row.title || row.error) continue;
      return {
        title: row.title,
        author: row.uploader || "",
        duration: typeof row.duration === "number" ? row.duration : null,
        views: typeof row.views === "number" ? row.views : null,
      };
    } catch {
      continue;
    }
  }
  return null;
}

export async function lookupFromUrl(raw: string): Promise<LookupResult> {
  const parsed = parseYouTube(raw);
  if (!parsed) {
    return { ok: false, error: "Paste a YouTube link — a watch URL, Short, or youtu.be link." };
  }

  const card: VideoCard = {
    id: parsed.id,
    url: parsed.canonical,
    title: "YouTube video",
    author: "",
    thumbnail: `https://i.ytimg.com/vi/${parsed.id}/hqdefault.jpg`,
    duration: null,
    views: null,
  };

  const oembedP = fetchOembed(parsed.canonical);
  const pipedP = fetchPipedMeta(parsed.id);
  const oembed = await oembedP;
  const piped = await new Promise<PipedMeta | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), 800);
    void pipedP.then((value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });

  if (oembed?.title) card.title = oembed.title;
  if (oembed?.author) card.author = oembed.author;
  if (oembed?.thumbnail) card.thumbnail = oembed.thumbnail;
  if (piped?.title) card.title = piped.title;
  if (piped?.author) card.author = piped.author;
  if (piped) {
    card.duration = piped.duration;
    card.views = piped.views;
  }

  return { ok: true, card };
}

function cobaltPayload(input: PrepareInput, canonical: string): Record<string, unknown> {
  if (input.mode === "audio") {
    return {
      url: canonical,
      downloadMode: "audio",
      audioFormat: "mp3",
      audioBitrate: input.bitrate,
      filenameStyle: "pretty",
    };
  }
  return {
    url: canonical,
    downloadMode: "auto",
    videoQuality: input.quality,
    youtubeVideoCodec: "h264",
    youtubeVideoContainer: "mp4",
    filenameStyle: "pretty",
  };
}

function takeHref(body: CobaltBody): { href: string; filename: string } | null {
  if ((body.status === "tunnel" || body.status === "redirect") && body.url?.startsWith("https://")) {
    return { href: body.url, filename: body.filename?.trim() || "download" };
  }
  if (body.status === "picker" && Array.isArray(body.picker)) {
    const item = body.picker.find((entry) => entry.url?.startsWith("https://"));
    if (item?.url) return { href: item.url, filename: body.filename?.trim() || "download" };
  }
  return null;
}

async function askMirror(endpoint: string, payload: Record<string, unknown>): Promise<{ href: string; filename: string }> {
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      signal: AbortSignal.timeout(12000),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": UA,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    throw new MirrorRefuse(name === "TimeoutError" || name === "AbortError" ? "timeout" : "unreachable");
  }

  let body: CobaltBody | null = null;
  try {
    body = (await res.json()) as CobaltBody;
  } catch {
    body = null;
  }
  if (!body) throw new MirrorRefuse(`http_${res.status}`);
  const file = takeHref(body);
  if (file) return file;
  throw new MirrorRefuse(body.error?.code || `http_${res.status}`);
}

type PipedStream = {
  url?: string;
  quality?: string;
  format?: string;
  mimeType?: string;
  videoOnly?: boolean;
};

function streamRank(quality: string | undefined): number {
  const n = Number.parseInt(quality ?? "", 10);
  return Number.isFinite(n) ? n : 0;
}

async function pipedFile(id: string, mode: "video" | "audio", title: string): Promise<{ href: string; filename: string; kind: "mp4" | "mp3" } | null> {
  for (const base of PIPED) {
    try {
      const { status, body } = await readJson(
        `${base}/streams/${id}`,
        { headers: { Accept: "application/json", "User-Agent": UA } },
        8000,
      );
      if (status !== 200 || !body || typeof body !== "object") continue;
      const row = body as { title?: string; videoStreams?: PipedStream[]; audioStreams?: PipedStream[] };
      const safeTitle = (row.title || title || "video").replace(/[\\/:*?"<>|]+/g, " ").trim();
      if (mode === "audio") {
        const audio = (row.audioStreams ?? [])
          .filter((s) => s.url?.startsWith("https://"))
          .sort((a, b) => streamRank(b.quality) - streamRank(a.quality));
        const best = audio[0];
        if (!best?.url) continue;
        const mime = (best.mimeType ?? "").toLowerCase();
        const ext = mime.includes("webm") ? "webm" : mime.includes("mp4") ? "m4a" : "mp3";
        return { href: best.url, filename: `${safeTitle}.${ext}`, kind: "mp3" };
      }
      const videos = (row.videoStreams ?? [])
        .filter((s) => s.url?.startsWith("https://") && s.videoOnly === false)
        .filter((s) => {
          const format = (s.format ?? "").toUpperCase();
          return format.includes("MPEG") || format.includes("MP4");
        })
        .sort((a, b) => streamRank(b.quality) - streamRank(a.quality));
      const best = videos[0];
      if (!best?.url) continue;
      const q = best.quality ? ` (${best.quality})` : "";
      return { href: best.url, filename: `${safeTitle}${q}.mp4`, kind: "mp4" };
    } catch {
      continue;
    }
  }
  return null;
}

export async function prepareFromUrl(input: PrepareInput): Promise<PrepareResult> {
  const started = Date.now();
  const parsed = parseYouTube(input.url);
  if (!parsed) {
    return { ok: false, error: "Paste a YouTube link — a watch URL, Short, or youtu.be link.", attempts: 0 };
  }

  const payload = cobaltPayload(input, parsed.canonical);
  const order = MIRRORS.map((_, i) => (i + pinnedMirror) % MIRRORS.length);
  let attempts = 0;
  let lastCode = "unreachable";

  for (const index of order) {
    const endpoint = MIRRORS[index];
    if (!endpoint) continue;
    attempts += 1;
    try {
      const file = await askMirror(endpoint, payload);
      pinnedMirror = index;
      const kind = input.mode === "audio" || file.filename.toLowerCase().endsWith(".mp3") ? "mp3" : "mp4";
      return {
        ok: true,
        href: file.href,
        filename: file.filename,
        kind,
        ms: Date.now() - started,
        attempts,
      };
    } catch (err) {
      lastCode = err instanceof MirrorRefuse ? err.code : "unreachable";
    }
  }

  // Last resort: a direct stream from a Piped front. Often lower quality, but
  // it doesn't depend on the same mirror that just failed.
  attempts += 1;
  const backup = await pipedFile(parsed.id, input.mode, "video");
  if (backup && input.mode === "video") {
    return {
      ok: true,
      href: backup.href,
      filename: backup.filename,
      kind: "mp4",
      ms: Date.now() - started,
      attempts,
    };
  }
  if (backup && input.mode === "audio") {
    return {
      ok: true,
      href: backup.href,
      filename: backup.filename,
      kind: "mp3",
      ms: Date.now() - started,
      attempts,
    };
  }

  return { ok: false, error: explain(lastCode), attempts };
}
