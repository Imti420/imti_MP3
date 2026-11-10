import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
import { t as parseYouTube } from "./youtube-XOKb2HSb.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/pull.functions-kKIMhLIt.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
/**
* Public cobalt-compatible API that still serves YouTube without a JWT.
* Ordered so the last one that answered is tried first on the next request.
*/
var MIRRORS = ["https://rue-cobalt.xenon.zone/"];
var PIPED = ["https://api.piped.private.coffee", "https://pipedapi.ducks.party"];
var UA = "Rivet/1.0 (youtube file helper)";
var pinnedMirror = 0;
var MirrorRefuse = class extends Error {
	code;
	constructor(code) {
		super(code);
		this.code = code;
	}
};
function explain(code) {
	const c = code.toLowerCase();
	if (c.includes("rate")) return "Every mirror is busy. Wait a few seconds and try again.";
	if (c.includes("unavailable") || c.includes("private") || c.includes("not_found") || c.includes("content")) return "That video is private, deleted, age-gated, or blocked where the mirrors sit.";
	if (c.includes("invalid") || c.includes("unsupported") || c.includes("link")) return "That link isn't a public YouTube video.";
	if (c.includes("login") || c.includes("auth") || c.includes("sign")) return "YouTube told the mirrors to sign in. Try again in a moment — a different mirror sometimes gets through.";
	if (c.includes("timeout") || c.includes("abort") || c.includes("timed")) return "The mirrors took too long. Try a lower quality, or hit Prepare again.";
	return "No mirror could fetch that video. Try again, or step the quality down.";
}
async function readJson(url, init, ms) {
	const res = await fetch(url, {
		...init,
		signal: AbortSignal.timeout(ms)
	});
	const text = await res.text();
	let body = null;
	if (text) try {
		body = JSON.parse(text);
	} catch {
		body = null;
	}
	return {
		status: res.status,
		body
	};
}
async function fetchOembed(canonical) {
	try {
		const { status, body } = await readJson(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(canonical)}`, { headers: {
			Accept: "application/json",
			"User-Agent": UA
		} }, 6e3);
		if (status !== 200 || !body || typeof body !== "object") return null;
		const row = body;
		return {
			title: row.title?.trim() || "",
			author: row.author_name?.trim() || "",
			thumbnail: row.thumbnail_url || ""
		};
	} catch {
		return null;
	}
}
async function fetchPipedMeta(id) {
	for (const base of PIPED) try {
		const { status, body } = await readJson(`${base}/streams/${id}`, { headers: {
			Accept: "application/json",
			"User-Agent": UA
		} }, 3500);
		if (status !== 200 || !body || typeof body !== "object") continue;
		const row = body;
		if (!row.title || row.error) continue;
		return {
			title: row.title,
			author: row.uploader || "",
			duration: typeof row.duration === "number" ? row.duration : null,
			views: typeof row.views === "number" ? row.views : null
		};
	} catch {
		continue;
	}
	return null;
}
async function lookupFromUrl(raw) {
	const parsed = parseYouTube(raw);
	if (!parsed) return {
		ok: false,
		error: "Paste a YouTube link — a watch URL, Short, or youtu.be link."
	};
	const card = {
		id: parsed.id,
		url: parsed.canonical,
		title: "YouTube video",
		author: "",
		thumbnail: `https://i.ytimg.com/vi/${parsed.id}/hqdefault.jpg`,
		duration: null,
		views: null
	};
	const oembedP = fetchOembed(parsed.canonical);
	const pipedP = fetchPipedMeta(parsed.id);
	const oembed = await oembedP;
	const piped = await new Promise((resolve) => {
		const timer = setTimeout(() => resolve(null), 800);
		pipedP.then((value) => {
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
	return {
		ok: true,
		card
	};
}
function cobaltPayload(input, canonical) {
	if (input.mode === "audio") return {
		url: canonical,
		downloadMode: "audio",
		audioFormat: "mp3",
		audioBitrate: input.bitrate,
		filenameStyle: "pretty"
	};
	return {
		url: canonical,
		downloadMode: "auto",
		videoQuality: input.quality,
		youtubeVideoCodec: "h264",
		youtubeVideoContainer: "mp4",
		filenameStyle: "pretty"
	};
}
function takeHref(body) {
	if ((body.status === "tunnel" || body.status === "redirect") && body.url?.startsWith("https://")) return {
		href: body.url,
		filename: body.filename?.trim() || "download"
	};
	if (body.status === "picker" && Array.isArray(body.picker)) {
		const item = body.picker.find((entry) => entry.url?.startsWith("https://"));
		if (item?.url) return {
			href: item.url,
			filename: body.filename?.trim() || "download"
		};
	}
	return null;
}
async function askMirror(endpoint, payload) {
	let res;
	try {
		res = await fetch(endpoint, {
			method: "POST",
			signal: AbortSignal.timeout(12e3),
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
				"User-Agent": UA
			},
			body: JSON.stringify(payload)
		});
	} catch (err) {
		const name = err instanceof Error ? err.name : "";
		throw new MirrorRefuse(name === "TimeoutError" || name === "AbortError" ? "timeout" : "unreachable");
	}
	let body = null;
	try {
		body = await res.json();
	} catch {
		body = null;
	}
	if (!body) throw new MirrorRefuse(`http_${res.status}`);
	const file = takeHref(body);
	if (file) return file;
	throw new MirrorRefuse(body.error?.code || `http_${res.status}`);
}
function streamRank(quality) {
	const n = Number.parseInt(quality ?? "", 10);
	return Number.isFinite(n) ? n : 0;
}
async function pipedFile(id, mode, title) {
	for (const base of PIPED) try {
		const { status, body } = await readJson(`${base}/streams/${id}`, { headers: {
			Accept: "application/json",
			"User-Agent": UA
		} }, 8e3);
		if (status !== 200 || !body || typeof body !== "object") continue;
		const row = body;
		const safeTitle = (row.title || title || "video").replace(/[\\/:*?"<>|]+/g, " ").trim();
		if (mode === "audio") {
			const best = (row.audioStreams ?? []).filter((s) => s.url?.startsWith("https://")).sort((a, b) => streamRank(b.quality) - streamRank(a.quality))[0];
			if (!best?.url) continue;
			const mime = (best.mimeType ?? "").toLowerCase();
			const ext = mime.includes("webm") ? "webm" : mime.includes("mp4") ? "m4a" : "mp3";
			return {
				href: best.url,
				filename: `${safeTitle}.${ext}`,
				kind: "mp3"
			};
		}
		const best = (row.videoStreams ?? []).filter((s) => s.url?.startsWith("https://") && s.videoOnly === false).filter((s) => {
			const format = (s.format ?? "").toUpperCase();
			return format.includes("MPEG") || format.includes("MP4");
		}).sort((a, b) => streamRank(b.quality) - streamRank(a.quality))[0];
		if (!best?.url) continue;
		const q = best.quality ? ` (${best.quality})` : "";
		return {
			href: best.url,
			filename: `${safeTitle}${q}.mp4`,
			kind: "mp4"
		};
	} catch {
		continue;
	}
	return null;
}
async function prepareFromUrl(input) {
	const started = Date.now();
	const parsed = parseYouTube(input.url);
	if (!parsed) return {
		ok: false,
		error: "Paste a YouTube link — a watch URL, Short, or youtu.be link.",
		attempts: 0
	};
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
				attempts
			};
		} catch (err) {
			lastCode = err instanceof MirrorRefuse ? err.code : "unreachable";
		}
	}
	attempts += 1;
	const backup = await pipedFile(parsed.id, input.mode, "video");
	if (backup && input.mode === "video") return {
		ok: true,
		href: backup.href,
		filename: backup.filename,
		kind: "mp4",
		ms: Date.now() - started,
		attempts
	};
	if (backup && input.mode === "audio" && backup.filename.endsWith(".mp3")) return {
		ok: true,
		href: backup.href,
		filename: backup.filename,
		kind: "mp3",
		ms: Date.now() - started,
		attempts
	};
	return {
		ok: false,
		error: explain(lastCode),
		attempts
	};
}
var lookupVideo_createServerFn_handler = createServerRpc({
	id: "76726cd018819f279e7af61f9924647e9f4e87e576ec39198af4ba0391ace437",
	name: "lookupVideo",
	filename: "src/lib/pull.functions.ts"
}, (opts) => lookupVideo.__executeServer(opts));
var lookupVideo = createServerFn({ method: "POST" }).validator((url) => url).handler(lookupVideo_createServerFn_handler, async ({ data }) => lookupFromUrl(data));
var prepareDownload_createServerFn_handler = createServerRpc({
	id: "8100c3344b744699d2c5cba6458872a1916a790bdeb2575deac44e0c6930e620",
	name: "prepareDownload",
	filename: "src/lib/pull.functions.ts"
}, (opts) => prepareDownload.__executeServer(opts));
var prepareDownload = createServerFn({ method: "POST" }).validator((input) => input).handler(prepareDownload_createServerFn_handler, async ({ data }) => prepareFromUrl(data));
//#endregion
export { lookupVideo_createServerFn_handler, prepareDownload_createServerFn_handler };
