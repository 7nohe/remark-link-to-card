import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import remarkHtml from "remark-html";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import type { LinkCardFetcher } from "../src";

/**
 * The bundle aliases cheerio to `cheerio/slim` (see build.config.ts), so the
 * Open Graph parsing in `dist/` runs through a different HTML parser than the
 * one the rest of the suite exercises through `src/`. Render a fixture with the
 * built output so that divergence cannot ship unnoticed.
 *
 * Skipped when `dist/` has not been built; CI builds before it tests.
 */
const distPath = path.resolve(__dirname, "../dist/index.mjs");
const built = fs.existsSync(distPath);

const pagesDir = path.resolve(__dirname, "pages");
const pageByUrl: Record<string, string> = {
	"https://example.com": "example.com.html",
	"https://github.com/": "github.com.html",
	"https://github.com/remarkjs/remark": "github.com-remarkjs-remark.html",
	"https://remark.js.org/": "remark.js.org.html",
	"https://yarnpkg.com/": "yarnpkg.com.html",
};

const fetcher: LinkCardFetcher = async (url) => {
	const file = pageByUrl[url];

	if (file === undefined) {
		throw new Error(`No captured page for ${url}`);
	}

	return fs.readFileSync(path.join(pagesDir, file), "utf8");
};

describe.skipIf(!built)("built bundle", () => {
	it("renders the fixture exactly like the committed snapshot", async () => {
		const { default: RemarkLinkToCard } = await import(
			/* @vite-ignore */ pathToFileURL(distPath).href
		);

		const rendered = String(
			await unified()
				.use(remarkParse)
				.use(RemarkLinkToCard, { fetcher })
				.use(remarkHtml, { sanitize: false })
				.process(
					fs.readFileSync(path.resolve(__dirname, "input/1.basic.md"), "utf8"),
				),
		)
			.trim()
			.replace(/\r\n/g, "\n");

		const snapshot = fs.readFileSync(
			path.resolve(__dirname, "output/1.basic.html"),
			"utf8",
		);
		// The snapshot appends a <style> block the plugin has no part in.
		const expected = snapshot.slice(0, snapshot.lastIndexOf("<style>")).trim();

		expect(rendered).toBe(expected);
	});
});
