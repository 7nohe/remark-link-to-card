import { Parser } from "htmlparser2";

export type OpenGraphMetadata = {
	title: string | undefined;
	description: string | undefined;
	image: string | undefined;
};

/**
 * Reads the Open Graph fields a link card needs out of a page's HTML.
 *
 * Only `<meta>` and `<title>` matter here, so the markup is streamed rather
 * than built into a tree — there is nothing to query afterwards.
 *
 * `<noscript>` is skipped. A spec-compliant HTML5 parser treats its contents
 * as raw text while scripting is enabled, and pages routinely park analytics
 * pixels and "please enable JavaScript" markup there; reading it would let a
 * tracking pixel become the card's thumbnail.
 */
export const readOpenGraph = (html: string): OpenGraphMetadata => {
	const openGraph = new Map<string, string>();
	let documentTitle: string | undefined;
	let metaDescription: string | undefined;
	let inTitle = false;
	let noscriptDepth = 0;

	const parser = new Parser({
		onopentag(name, attributes) {
			if (name === "noscript") {
				noscriptDepth += 1;
				return;
			}

			if (noscriptDepth > 0) {
				return;
			}

			if (name === "title") {
				inTitle = true;
				return;
			}

			if (name !== "meta") {
				return;
			}

			// Pages use `property` and `name` interchangeably for Open Graph, and
			// a few write the value as `value` rather than `content`.
			const key = (attributes.property ?? attributes.name)?.toLowerCase();
			const value = attributes.content ?? attributes.value;

			if (key === undefined || value === undefined) {
				return;
			}

			if (key === "description") {
				metaDescription = value;
			}

			if (key === "og:title" || key === "og:description") {
				// A page that repeats a scalar field means the last one.
				openGraph.set(key, value);
			}

			if (
				(key === "og:image" || key === "og:image:url") &&
				!openGraph.has("og:image")
			) {
				// og:image may be repeated to offer several sizes; the first is the
				// primary one.
				openGraph.set("og:image", value);
			}
		},
		ontext(text) {
			if (inTitle) {
				documentTitle = (documentTitle ?? "") + text;
			}
		},
		onclosetag(name) {
			if (name === "noscript") {
				noscriptDepth = Math.max(0, noscriptDepth - 1);
			}

			if (name === "title") {
				inTitle = false;
			}
		},
	});

	parser.write(html);
	parser.end();

	return {
		title: openGraph.get("og:title") ?? documentTitle,
		description: openGraph.get("og:description") ?? metaDescription,
		image: openGraph.get("og:image"),
	};
};
