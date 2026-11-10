import { i as __toESM } from "../_runtime.mjs";
import { b as require_jsx_runtime, q as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { t as parseYouTube } from "./youtube-XOKb2HSb.mjs";
import { a as Download, i as Film, n as RotateCw, o as ClipboardPaste, r as Music } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-DKzW2Ujp.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var lookupVideo = createServerFn({ method: "POST" }).validator((url) => url).handler(createSsrRpc("76726cd018819f279e7af61f9924647e9f4e87e576ec39198af4ba0391ace437"));
var prepareDownload = createServerFn({ method: "POST" }).validator((input) => input).handler(createSsrRpc("8100c3344b744699d2c5cba6458872a1916a790bdeb2575deac44e0c6930e620"));
var RECENT_KEY = "rivet.recent";
var QUALITIES = [
	"1080",
	"720",
	"480",
	"360"
];
var BITRATES = ["320", "128"];
function clock(total) {
	const s = Math.max(0, Math.floor(total));
	const h = Math.floor(s / 3600);
	const m = Math.floor(s % 3600 / 60);
	const sec = s % 60;
	if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
	return `${m}:${String(sec).padStart(2, "0")}`;
}
function compact(n) {
	if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "")}M`;
	if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "")}k`;
	return String(n);
}
function loadRecent() {
	try {
		const raw = localStorage.getItem(RECENT_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((row) => row && typeof row.url === "string" && typeof row.id === "string").slice(0, 6);
	} catch {
		return [];
	}
}
function remember(card) {
	const next = [{
		id: card.id,
		title: card.title,
		url: card.url,
		at: Date.now()
	}, ...loadRecent().filter((row) => row.id !== card.id)].slice(0, 6);
	localStorage.setItem(RECENT_KEY, JSON.stringify(next));
	return next;
}
function Bench() {
	const [raw, setRaw] = (0, import_react.useState)("");
	const [mode, setMode] = (0, import_react.useState)("video");
	const [quality, setQuality] = (0, import_react.useState)("1080");
	const [bitrate, setBitrate] = (0, import_react.useState)("128");
	const [card, setCard] = (0, import_react.useState)(null);
	const [lookupError, setLookupError] = (0, import_react.useState)(null);
	const [looking, setLooking] = (0, import_react.useState)(false);
	const [pulling, setPulling] = (0, import_react.useState)(false);
	const [file, setFile] = (0, import_react.useState)(null);
	const [pullError, setPullError] = (0, import_react.useState)(null);
	const [copied, setCopied] = (0, import_react.useState)(false);
	const [recent, setRecent] = (0, import_react.useState)([]);
	const [ready, setReady] = (0, import_react.useState)(false);
	const requestRef = (0, import_react.useRef)(0);
	const parsed = parseYouTube(raw);
	(0, import_react.useEffect)(() => {
		setReady(true);
		setRecent(loadRecent());
	}, []);
	(0, import_react.useEffect)(() => {
		requestRef.current += 1;
		setFile(null);
		setPullError(null);
		setCopied(false);
		setPulling(false);
	}, [
		parsed?.id,
		mode,
		quality,
		bitrate
	]);
	(0, import_react.useEffect)(() => {
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
			lookupVideo({ data: canonical }).then((result) => {
				if (cancelled) return;
				if (result.ok) {
					setCard(result.card);
					setLookupError(null);
				} else {
					setCard(null);
					setLookupError(result.error);
				}
			}).catch(() => {
				if (cancelled) return;
				setLookupError("Couldn't read that link. You can still try Prepare.");
			}).finally(() => {
				if (!cancelled) setLooking(false);
			});
		}, 280);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [
		parsed?.id,
		parsed?.canonical,
		raw
	]);
	async function onPaste() {
		try {
			const text = await navigator.clipboard.readText();
			if (text) setRaw(text.trim());
		} catch {
			setLookupError("Clipboard is blocked. Paste the link into the field.");
		}
	}
	async function onPrepare(event) {
		event.preventDefault();
		if (!parsed || pulling) return;
		const ticket = ++requestRef.current;
		const video = parsed;
		setPulling(true);
		setPullError(null);
		setFile(null);
		try {
			const result = await prepareDownload({ data: {
				url: video.canonical,
				mode,
				quality,
				bitrate
			} });
			if (requestRef.current !== ticket) return;
			if (result.ok) {
				setFile(result);
				const snapshot = card ?? {
					id: video.id,
					url: video.canonical,
					title: result.filename,
					author: "",
					thumbnail: "",
					duration: null,
					views: null
				};
				setRecent(remember(snapshot));
			} else setPullError(result.error);
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
		card?.views != null && card.views > 0 ? `${compact(card.views)} views` : null
	].filter(Boolean);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-center justify-between gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "size-3 shrink-0 rounded-full bg-rivet",
						"aria-hidden": "true"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-serif text-2xl tracking-tight",
						children: "Rivet"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "MP4 · MP3"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
					className: "font-serif text-4xl leading-tight tracking-tight sm:text-5xl",
					children: [
						"The link goes in.",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
						"The file comes out."
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "max-w-md text-base leading-6 text-muted",
					children: "YouTube to a real MP4 or MP3. No convert queue. If one mirror stalls, the next one takes the job."
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				onSubmit: onPrepare,
				className: "flex flex-col gap-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-2xl border border-line bg-card p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								htmlFor: "yt",
								className: "sr-only",
								children: "YouTube link"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-2 sm:flex-row",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									id: "yt",
									value: raw,
									onChange: (event) => setRaw(event.target.value),
									placeholder: "https://youtu.be/…",
									autoCapitalize: "off",
									autoCorrect: "off",
									spellCheck: false,
									enterKeyHint: "go",
									className: "h-12 w-full rounded-xl border border-line bg-paper px-4 text-base text-ink outline-none placeholder:text-muted focus-visible:border-ink"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => void onPaste(),
									className: "inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 text-sm font-medium text-ink",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ClipboardPaste, {
										className: "size-4",
										"aria-hidden": "true"
									}), "Paste"]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "px-1 pt-3 text-sm leading-6 text-muted",
								"aria-live": "polite",
								children: looking ? "Reading the link…" : lookupError ? lookupError : "Watch links, Shorts, and youtu.be all work."
							})
						]
					}),
					card && parsed ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
						className: "overflow-hidden rounded-2xl border border-line bg-card",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: card.thumbnail,
							alt: "",
							className: "aspect-video w-full object-cover",
							referrerPolicy: "no-referrer"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-1 px-4 py-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-base font-medium leading-6",
								children: card.title
							}), metaBits.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm leading-6 text-muted",
								children: metaBits.join(" · ")
							}) : null]
						})]
					}) : null,
					parsed ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", {
						className: "flex flex-col gap-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
								className: "sr-only",
								children: "Format"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid grid-cols-2 gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModeButton, {
									active: mode === "video",
									onClick: () => setMode("video"),
									label: "Video",
									icon: "film"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModeButton, {
									active: mode === "audio",
									onClick: () => setMode("audio"),
									label: "Audio",
									icon: "music"
								})]
							}),
							mode === "video" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid grid-cols-4 gap-2",
								children: QUALITIES.map((q) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
									pressed: quality === q,
									onClick: () => setQuality(q),
									label: q
								}, q))
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid grid-cols-2 gap-2",
								children: BITRATES.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
									pressed: bitrate === b,
									onClick: () => setBitrate(b),
									label: `${b} kbps`
								}, b))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm leading-6 text-muted",
								children: mode === "video" ? "H.264 MP4 with audio already mixed in. If the upload isn't that sharp, you get the best it actually has." : "MP3, ready to play. 128 kbps is the quicker, smaller file."
							})
						]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "submit",
						disabled: !parsed || pulling,
						"aria-busy": pulling,
						className: "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-rivet px-5 text-base font-medium text-foam disabled:opacity-50",
						children: [pulling ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCw, {
							className: "size-4 animate-spin",
							"aria-hidden": "true"
						}) : null, pulling ? "Asking mirrors…" : mode === "audio" ? "Prepare MP3" : "Prepare MP4"]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				"aria-live": "polite",
				className: "flex flex-col gap-3",
				children: [pullError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "rounded-2xl border border-line bg-card px-4 py-3 text-sm leading-6 text-ink",
					children: pullError
				}) : null, file ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col gap-2 rounded-2xl border border-line bg-card p-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
							href: file.href,
							target: "_blank",
							rel: "noreferrer",
							className: "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-base font-medium text-paper",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, {
									className: "size-4",
									"aria-hidden": "true"
								}),
								"Save ",
								file.kind === "mp3" ? "MP3" : "MP4"
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "px-1 text-sm leading-6 text-ink",
							children: file.filename
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "px-1 text-sm leading-6 text-muted",
							children: [
								"Ready in ",
								(file.ms / 1e3).toFixed(1),
								"s",
								file.attempts > 1 ? ` · mirror ${file.attempts}` : "",
								". On a phone, open it and use the share sheet to keep the file."
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => void onCopy(),
							className: "h-11 rounded-xl border border-line text-sm font-medium text-ink",
							children: copied ? "Link copied" : "Copy file link"
						})
					]
				}) : null]
			}),
			ready && recent.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "flex flex-col gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-sm font-medium text-muted",
					children: "Recent"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "flex flex-col",
					children: recent.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "border-t border-line",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setRaw(row.url),
							className: "flex w-full items-center justify-between gap-3 py-3 text-left",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "line-clamp-1 text-sm font-medium",
								children: row.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "shrink-0 text-sm text-muted",
								children: "Again"
							})]
						})
					}, row.id))
				})]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
				className: "border-t border-line pt-4 text-sm leading-6 text-muted",
				children: "Only save videos you're allowed to keep. Rivet doesn't host the file — a public mirror builds the link, and your browser downloads it."
			})
		]
	});
}
function ModeButton({ active, onClick, label, icon }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		"aria-pressed": active,
		onClick,
		className: active ? "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-ink text-sm font-medium text-paper" : "inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-paper text-sm font-medium text-ink",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(icon === "film" ? Film : Music, {
			className: "size-4",
			"aria-hidden": "true"
		}), label]
	});
}
function Chip({ pressed, onClick, label }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		"aria-pressed": pressed,
		onClick,
		className: pressed ? "h-11 rounded-xl bg-ink text-sm font-medium text-paper" : "h-11 rounded-xl border border-line bg-paper text-sm font-medium text-ink",
		children: label
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 py-8 sm:py-14",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bench, {})
	});
}
//#endregion
export { Home as component };
