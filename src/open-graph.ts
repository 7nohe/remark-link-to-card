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
	let ogTitle: string | undefined;
	let ogDescription: string | undefined;
	let ogImage: string | undefined;
	let ogImageUrl: string | undefined;
	let documentTitle: string | undefined;
	let metaDescription: string | undefined;
	let inHead = false;
	let inTitle = false;
	let hasTitle = false;
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

			if (name === "head") {
				inHead = true;
				return;
			}

			if (name === "title") {
				// A document can carry several — the <head> one, and one inside
				// every inline SVG icon. Only the first is the page's own.
				if (!hasTitle) {
					inTitle = true;
				}
				return;
			}

			if (name !== "meta") {
				return;
			}

			// Pages use `property` and `name` interchangeably for Open Graph, and
			// a few write the value as `value` rather than `content`. An attribute
			// that is present but empty counts as absent, so that a blank og:title
			// falls through to <title> rather than blanking the card.
			const key = (attributes.property || attributes.name)?.toLowerCase();
			const value = attributes.content || attributes.value;

			if (!key || !value) {
				return;
			}

			// The description fallback is scoped to <head>; a stray description
			// meta in the body is not the page describing itself.
			if (key === "description" && inHead) {
				metaDescription = value;
			}

			// A page that repeats a scalar field means the last one.
			if (key === "og:title") {
				ogTitle = value;
			}

			if (key === "og:description") {
				ogDescription = value;
			}

			// og:image may be repeated to offer several sizes; the first is the
			// primary one. og:image:url is a synonym, but only a fallback for it —
			// an explicit og:image wins wherever it appears.
			if (key === "og:image") {
				ogImage ??= value;
			}

			if (key === "og:image:url") {
				ogImageUrl ??= value;
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
				return;
			}

			if (noscriptDepth > 0) {
				return;
			}

			if (name === "head") {
				inHead = false;
			}

			if (name === "title" && inTitle) {
				inTitle = false;
				hasTitle = true;
			}
		},
	});

	parser.write(html);
	parser.end();

	return {
		title: ogTitle ?? documentTitle,
		description: ogDescription ?? metaDescription,
		image: ogImage ?? ogImageUrl,
	};
};
