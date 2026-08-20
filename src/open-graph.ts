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
 * Which parts of a document count as the page describing itself:
 *
 * - `og:*` is honoured anywhere. Malformed pages put it after `</head>`, and
 *   streaming means there is no tree to repair one back into place.
 * - A plain `description` meta only counts inside `<head>`; one in the body is
 *   page content, not the page describing itself.
 * - Only the first `<title>` is the page's own. Every inline SVG icon brings
 *   another one.
 * - `<noscript>` is skipped entirely. A spec-compliant HTML5 parser treats its
 *   contents as raw text while scripting is enabled, and pages routinely park
 *   analytics pixels and "please enable JavaScript" markup there; reading it
 *   would let a tracking pixel become the card's thumbnail.
 */
export const readOpenGraph = (html: string): OpenGraphMetadata => {
	let ogTitle: string | undefined;
	let ogDescription: string | undefined;
	let ogImage: string | undefined;
	let ogImageUrl: string | undefined;
	let documentTitle: string | undefined;
	let metaDescription: string | undefined;
	let inHead = false;
	// "pending" until the first <title> opens, "read" once it closes; only the
	// text seen while "reading" belongs to the page.
	let title: "pending" | "reading" | "read" = "pending";
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
				if (title === "pending") {
					title = "reading";
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

			// A repeated scalar field means the last one (`=`); a repeated image
			// means the first, since the rest are alternate sizes (`??=`).
			switch (key) {
				case "description":
					if (inHead) {
						metaDescription = value;
					}
					break;
				case "og:title":
					ogTitle = value;
					break;
				case "og:description":
					ogDescription = value;
					break;
				case "og:image":
					ogImage ??= value;
					break;
				// A synonym for og:image, but only a fallback for it: an explicit
				// og:image wins wherever it appears.
				case "og:image:url":
					ogImageUrl ??= value;
					break;
			}
		},
		ontext(text) {
			if (title === "reading") {
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

			if (name === "title" && title === "reading") {
				title = "read";
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
