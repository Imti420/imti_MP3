//#region node_modules/.nitro/vite/services/ssr/assets/youtube-XOKb2HSb.js
var ID_RE = /^[a-zA-Z0-9_-]{11}$/;
function cleanId(value) {
	const id = value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 11);
	return ID_RE.test(id) ? id : null;
}
/** Accepts watch, shorts, embed, live, music, youtu.be, or a bare 11-character id. */
function parseYouTube(raw) {
	const trimmed = raw.trim();
	if (!trimmed) return null;
	if (ID_RE.test(trimmed)) return {
		id: trimmed,
		canonical: `https://www.youtube.com/watch?v=${trimmed}`
	};
	const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
	let url;
	try {
		url = new URL(withScheme);
	} catch {
		return null;
	}
	const host = url.hostname.toLowerCase().replace(/^www\./, "");
	if (!(host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com" || host === "youtu.be")) return null;
	let id = null;
	if (host === "youtu.be") id = cleanId(url.pathname.split("/").filter(Boolean)[0] ?? "");
	else {
		const parts = url.pathname.split("/").filter(Boolean);
		const head = parts[0] ?? "";
		if (head === "shorts" || head === "embed" || head === "live" || head === "v") id = cleanId(parts[1] ?? "");
		else id = cleanId(url.searchParams.get("v") ?? "");
	}
	if (!id) return null;
	return {
		id,
		canonical: `https://www.youtube.com/watch?v=${id}`
	};
}
//#endregion
export { parseYouTube as t };
