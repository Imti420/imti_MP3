import { useEffect, useRef, useState, type FormEvent } from "react";
import { ClipboardPaste, Download, Film, Music, RotateCw } from "lucide-react";
import { lookupVideo, prepareDownload } from "@/lib/pull.functions";
import type { PrepareResult, VideoCard } from "@/lib/prepare";
import { parseYouTube } from "@/lib/youtube";

type Mode = "video" | "audio";
type Quality = "1080" | "720" | "480" | "360";
type Bitrate = "128" | "320";

type Recent = {
  id: string;
  title: string;
  url: string;
  at: number;
};

const RECENT_KEY = "rivet.recent";
const QUALITIES: Quality[] = ["1080", "720", "480", "360"];
const BITRATES: Bitrate[] = ["320", "128"];

function clock(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}k`;
  return String(n);
}

function loadRecent(): Recent[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Recent[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row) => row && typeof row.url === "string" && typeof row.id === "string").slice(0, 6);
  } catch {
    return [];
  }
}

function remember(card: VideoCard) {
  const next: Recent[] = [
    { id: card.id, title: card.title, url: card.url, at: Date.now() },
    ...loadRecent().filter((row) => row.id !== card.id),
  ].slice(0, 6);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

export function Bench() {
  const [raw, setRaw] = useState("");
  const [mode, setMode] = useState<Mode>("video");
  const [quality, setQuality] = useState<Quality>("1080");
  const [bitrate, setBitrate] = useState<Bitrate>("128");
  const [card, setCard] = useState<VideoCard | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [file, setFile] = useState<Extract<PrepareResult, { ok: true }> | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [ready, setReady] = useState(false);
  const requestRef = useRef(0);

  const parsed = parseYouTube(raw);

  useEffect(() => {
    setReady(true);
    setRecent(loadRecent());
  }, []);

  useEffect(() => {
    requestRef.current += 1;
    setFile(null);
    setPullError(null);
    setCopied(false);
    setPulling(false);
  }, [parsed?.id, mode, quality, bitrate]);

  useEffect(() => {
    if (!parsed) {
      setCard(null);
      setLooking(false);
      const text = raw.trim();
      const looksDone = /youtube|youtu\.be/i.test(text) || text.length > 24;
      setLookupError(looksDone ? "That isn't a YouTube link." : null);
      return;
    }
    const canonical = parsed.canonical;
    let cancelled = false;
    const timer = setTimeout(() => {
      setLooking(true);
      void lookupVideo({ data: canonical })
        .then((result) => {
          if (cancelled) return;
          if (result.ok) {
            setCard(result.card);
            setLookupError(null);
          } else {
            setCard(null);
            setLookupError(result.error);
          }
        })
        .catch(() => {
          if (cancelled) return;
          setLookupError("Couldn't read that link. You can still try Prepare.");
        })
        .finally(() => {
          if (!cancelled) setLooking(false);
        });
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [parsed?.id, parsed?.canonical, raw]);

  async function onPaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setRaw(text.trim());
    } catch {
      setLookupError("Clipboard is blocked. Paste the link into the field.");
    }
  }

  async function onPrepare(event: FormEvent) {
    event.preventDefault();
    if (!parsed || pulling) return;
    const ticket = ++requestRef.current;
    const video = parsed;
    setPulling(true);
    setPullError(null);
    setFile(null);
    try {
      const result = await prepareDownload({
        data: { url: video.canonical, mode, quality, bitrate },
      });
      if (requestRef.current !== ticket) return;
      if (result.ok) {
        setFile(result);
        const snapshot: VideoCard = card ?? {
          id: video.id,
          url: video.canonical,
          title: result.filename,
          author: "",
          thumbnail: "",
          duration: null,
          views: null,
        };
        setRecent(remember(snapshot));
      } else {
        setPullError(result.error);
      }
    } catch {
      if (requestRef.current !== ticket) return;
      setPullError("The request didn't finish. Hit Prepare again — Rivet will try the mirrors over.");
    } finally {
      if (requestRef.current === ticket) setPulling(false);
    }
  }

  async function onCopy() {
    if (!file) return;
    try {
      await navigator.clipboard.writeText(file.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const metaBits = [
    card?.author,
    card?.duration != null ? clock(card.duration) : null,
    card?.views != null && card.views > 0 ? `${compact(card.views)} views` : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="size-3 shrink-0 rounded-full bg-rivet" aria-hidden="true" />
          <p className="font-serif text-2xl tracking-tight">Rivet</p>
        </div>
        <p className="text-sm text-muted">MP4 · MP3</p>
      </header>

      <div className="flex flex-col gap-3">
        <h1 className="font-serif text-4xl leading-tight tracking-tight sm:text-5xl">
          The link goes in.
          <br />
          The file comes out.
        </h1>
        <p className="max-w-md text-base leading-6 text-muted">
          YouTube to a real MP4 or MP3. No convert queue. If one mirror stalls, the next one takes the job.
        </p>
      </div>

      <form onSubmit={onPrepare} className="flex flex-col gap-4">
        <div className="rounded-2xl border border-line bg-card p-3">
          <label htmlFor="yt" className="sr-only">
            YouTube link
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="yt"
              value={raw}
              onChange={(event) => setRaw(event.target.value)}
              placeholder="https://youtu.be/…"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              className="h-12 w-full rounded-xl border border-line bg-paper px-4 text-base text-ink outline-none placeholder:text-muted focus-visible:border-ink"
            />
            <button
              type="button"
              onClick={() => void onPaste()}
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 text-sm font-medium text-ink"
            >
              <ClipboardPaste className="size-4" aria-hidden="true" />
              Paste
            </button>
          </div>
          <p className="px-1 pt-3 text-sm leading-6 text-muted" aria-live="polite">
            {looking
              ? "Reading the link…"
              : lookupError
                ? lookupError
                : "Watch links, Shorts, and youtu.be all work."}
          </p>
        </div>

        {card && parsed ? (
          <article className="overflow-hidden rounded-2xl border border-line bg-card">
            <img
              src={card.thumbnail}
              alt=""
              className="aspect-video w-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="flex flex-col gap-1 px-4 py-3">
              <h2 className="text-base font-medium leading-6">{card.title}</h2>
              {metaBits.length > 0 ? <p className="text-sm leading-6 text-muted">{metaBits.join(" · ")}</p> : null}
            </div>
          </article>
        ) : null}

        {parsed ? (
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">Format</legend>
            <div className="grid grid-cols-2 gap-2">
              <ModeButton active={mode === "video"} onClick={() => setMode("video")} label="Video" icon="film" />
              <ModeButton active={mode === "audio"} onClick={() => setMode("audio")} label="Audio" icon="music" />
            </div>
            {mode === "video" ? (
              <div className="grid grid-cols-4 gap-2">
                {QUALITIES.map((q) => (
                  <Chip key={q} pressed={quality === q} onClick={() => setQuality(q)} label={q} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {BITRATES.map((b) => (
                  <Chip key={b} pressed={bitrate === b} onClick={() => setBitrate(b)} label={`${b} kbps`} />
                ))}
              </div>
            )}
            <p className="text-sm leading-6 text-muted">
              {mode === "video"
                ? "H.264 MP4 with audio already mixed in. If the upload isn't that sharp, you get the best it actually has."
                : "MP3, ready to play. 128 kbps is the quicker, smaller file."}
            </p>
          </fieldset>
        ) : null}

        <button
          type="submit"
          disabled={!parsed || pulling}
          aria-busy={pulling}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-rivet px-5 text-base font-medium text-foam disabled:opacity-50"
        >
          {pulling ? <RotateCw className="size-4 animate-spin" aria-hidden="true" /> : null}
          {pulling ? "Asking mirrors…" : mode === "audio" ? "Prepare MP3" : "Prepare MP4"}
        </button>
      </form>

      <div aria-live="polite" className="flex flex-col gap-3">
        {pullError ? (
          <p className="rounded-2xl border border-line bg-card px-4 py-3 text-sm leading-6 text-ink">{pullError}</p>
        ) : null}
        {file ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-3">
            <a
              href={file.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-base font-medium text-paper"
            >
              <Download className="size-4" aria-hidden="true" />
              Save {file.kind === "mp3" ? "MP3" : "MP4"}
            </a>
            <p className="px-1 text-sm leading-6 text-ink">{file.filename}</p>
            <p className="px-1 text-sm leading-6 text-muted">
              Ready in {(file.ms / 1000).toFixed(1)}s
              {file.attempts > 1 ? ` · mirror ${file.attempts}` : ""}. On a phone, open it and use the share sheet to
              keep the file.
            </p>
            <button
              type="button"
              onClick={() => void onCopy()}
              className="h-11 rounded-xl border border-line text-sm font-medium text-ink"
            >
              {copied ? "Link copied" : "Copy file link"}
            </button>
          </div>
        ) : null}
      </div>

      {ready && recent.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted">Recent</h2>
          <ul className="flex flex-col">
            {recent.map((row) => (
              <li key={row.id} className="border-t border-line">
                <button
                  type="button"
                  onClick={() => setRaw(row.url)}
                  className="flex w-full items-center justify-between gap-3 py-3 text-left"
                >
                  <span className="line-clamp-1 text-sm font-medium">{row.title}</span>
                  <span className="shrink-0 text-sm text-muted">Again</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="border-t border-line pt-4 text-sm leading-6 text-muted">
        Only save videos you're allowed to keep. Rivet doesn't host the file — a public mirror builds the link, and
        your browser downloads it.
      </footer>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: "film" | "music";
}) {
  const Icon = icon === "film" ? Film : Music;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        active
          ? "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-ink text-sm font-medium text-paper"
          : "inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-paper text-sm font-medium text-ink"
      }
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function Chip({ pressed, onClick, label }: { pressed: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={
        pressed
          ? "h-11 rounded-xl bg-ink text-sm font-medium text-paper"
          : "h-11 rounded-xl border border-line bg-paper text-sm font-medium text-ink"
      }
    >
      {label}
    </button>
  );
}
