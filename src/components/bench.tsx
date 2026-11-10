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
    <div className="flex flex-col gap-7">
      <header className="flex items-end justify-between gap-4 border-b-[3px] border-ink pb-4">
        <div>
          <p className="kicker">DOWNLOAD BENCH · LOCAL</p>
          <p className="display mt-1 text-4xl sm:text-5xl">
            RIVET<span className="text-accent">//</span>YT
          </p>
        </div>
        <span className="sticker">MP4 · MP3</span>
      </header>

      <div className="flex flex-col gap-2">
        <h1 className="display text-[clamp(2.4rem,8vw,3.6rem)]">
          Link in.
          <br />
          File out.
        </h1>
        <p className="max-w-md text-base leading-relaxed text-mute">
          YouTube → real MP4 or MP3. No convert queue. If one mirror stalls, the next one takes the job.
        </p>
      </div>

      <form onSubmit={onPrepare} className="flex flex-col gap-4">
        <div className="window">
          <div className="window-bar">
            <span>paste · look up · prepare</span>
            <span>{looking ? "READING…" : parsed ? "LINK OK" : "WAITING"}</span>
          </div>
          <div className="flex flex-col gap-3 p-3 sm:p-4">
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
                className="field"
              />
              <button type="button" onClick={() => void onPaste()} className="press shrink-0">
                <ClipboardPaste className="size-4" aria-hidden="true" />
                Paste
              </button>
            </div>
            <p className="kicker px-0.5" aria-live="polite">
              {looking
                ? "Reading the link…"
                : lookupError
                  ? lookupError
                  : "Watch · Shorts · youtu.be"}
            </p>
          </div>
        </div>

        {card && parsed ? (
          <article className="window">
            <div className="window-bar">
              <span>preview</span>
              <span>YOUTUBE</span>
            </div>
            <img
              src={card.thumbnail}
              alt=""
              className="aspect-video w-full border-b-[3px] border-ink object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="flex flex-col gap-1 px-4 py-3">
              <h2 className="font-display text-xl font-bold uppercase leading-tight tracking-tight">
                {card.title}
              </h2>
              {metaBits.length > 0 ? (
                <p className="font-mono text-xs tracking-wide text-mute">{metaBits.join(" · ")}</p>
              ) : null}
            </div>
          </article>
        ) : null}

        {parsed ? (
          <fieldset className="flex flex-col gap-3">
            <legend className="kicker">Format</legend>
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
            <p className="text-sm leading-relaxed text-mute">
              {mode === "video"
                ? "H.264 MP4 with audio mixed in. If the upload isn't that sharp, you get the best it has."
                : "MP3, ready to play. 128 kbps is the quicker, smaller file."}
            </p>
          </fieldset>
        ) : null}

        <button type="submit" disabled={!parsed || pulling} aria-busy={pulling} className="press press-accent w-full">
          {pulling ? <RotateCw className="size-4 animate-spin" aria-hidden="true" /> : null}
          {pulling ? "Asking mirrors…" : mode === "audio" ? "Prepare MP3" : "Prepare MP4"}
        </button>
      </form>

      <div aria-live="polite" className="flex flex-col gap-3">
        {pullError ? (
          <p className="border-[3px] border-ink bg-panel px-4 py-3 text-sm leading-relaxed shadow-[4px_4px_0_0_var(--color-accent)]">
            {pullError}
          </p>
        ) : null}
        {file ? (
          <div className="window">
            <div className="window-bar">
              <span>ready</span>
              <span>{(file.ms / 1000).toFixed(1)}S</span>
            </div>
            <div className="flex flex-col gap-3 p-3 sm:p-4">
              <a
                href={file.href}
                target="_blank"
                rel="noreferrer"
                className="press press-ink w-full no-underline"
              >
                <Download className="size-4" aria-hidden="true" />
                Save {file.kind === "mp3" ? "MP3" : "MP4"}
              </a>
              <p className="font-mono text-xs leading-relaxed">{file.filename}</p>
              <p className="text-sm leading-relaxed text-mute">
                Ready in {(file.ms / 1000).toFixed(1)}s
                {file.attempts > 1 ? ` · mirror ${file.attempts}` : ""}. On a phone, open it and use the share sheet.
              </p>
              <button type="button" onClick={() => void onCopy()} className="press w-full">
                {copied ? "Link copied" : "Copy file link"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {ready && recent.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="kicker">Recent</h2>
          <ul className="overflow-hidden border-[3px] border-ink bg-panel shadow-[4px_4px_0_0_var(--color-ink)]">
            {recent.map((row) => (
              <li key={row.id} className="border-b-[2px] border-ink last:border-b-0">
                <button
                  type="button"
                  onClick={() => setRaw(row.url)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-yellow/40"
                >
                  <span className="line-clamp-1 font-display text-lg font-bold uppercase leading-none tracking-tight">
                    {row.title}
                  </span>
                  <span className="kicker shrink-0 text-accent">Again</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="border-t-[3px] border-ink pt-4 font-mono text-[11px] leading-relaxed tracking-wide text-mute">
        Only save videos you&apos;re allowed to keep. Rivet doesn&apos;t host the file — a public mirror builds the
        link, and your browser downloads it.
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
    <button type="button" aria-pressed={active} onClick={onClick} className={active ? "press press-ink w-full" : "press w-full"}>
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function Chip({ pressed, onClick, label }: { pressed: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className={pressed ? "press press-ink w-full !min-h-11 !text-sm" : "press w-full !min-h-11 !text-sm"}>
      {label}
    </button>
  );
}
