import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
	entries: ["src/index"],
	declaration: true,
	clean: true,
	alias: {
		/**
		 * open-graph-scraper-lite only ever calls cheerio's `load()` on an HTML
		 * string, but importing cheerio's main entry also drags in `fromURL` and
		 * with it undici, which `inlineDependencies` then bundles. That pulled
		 * `node:module`, `buffer` and `string_decoder` into the output and tripled
		 * its size. `cheerio/slim` is cheerio's own entry point for exactly this
		 * case: the same `load()` API without the fetching machinery.
		 *
		 * It parses with htmlparser2 rather than parse5. The two agree on every
		 * fixture here and on malformed markup generally; they differ on `<meta>`
		 * inside `<noscript>`, which parse5 treats as raw text per the HTML5
		 * parsing rules and htmlparser2 reads as an element.
		 */
		cheerio: "cheerio/slim",
	},
	rollup: {
		emitCJS: true,
		inlineDependencies: true,
	},
	externals: ["mdast"],
});
