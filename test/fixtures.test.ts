/// <reference types="vite/client" />

import process from "node:process";
import remarkHtml from "remark-html";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import RemarkLinkToCard, { type LinkCardFetcher } from "../src";
import cssBase from "../styles/link-card-base.css?raw";

/**
 * Head markup captured from each site the fixtures link to.
 *
 * Requesting them for real made the snapshots depend on pages nobody here
 * controls: they went stale as soon as one of those sites edited its Open
 * Graph tags, and the suite could not run offline at all.
 */
const pages = import.meta.glob("./pages/*.html", { as: "raw", eager: true });

const pageByUrl: Record<string, string> = {
	"https://example.com": pages["./pages/example.com.html"],
	"https://github.com/": pages["./pages/github.com.html"],
	"https://github.com/remarkjs/remark":
		pages["./pages/github.com-remarkjs-remark.html"],
	"https://remark.js.org/": pages["./pages/remark.js.org.html"],
	"https://yarnpkg.com/": pages["./pages/yarnpkg.com.html"],
};

/**
 * Stands in for the network. Anything without a captured page — the PDF the
 * fixtures link to, for one — throws, which is how the real fetcher reports a
 * response it cannot read, so the card still falls back to the link text.
 */
const fetcher: LinkCardFetcher = async (url) => {
	const html = pageByUrl[url];

	if (html === undefined) {
		throw new Error(`No captured page for ${url}`);
	}

	return html;
};

const CSS = `
html {
  font-family: sans-serif;
}

* {
  box-sizing: border-box;
}

${cssBase}
`;

describe("fixtures", () => {
	const files = import.meta.glob("./input/*.md", { as: "raw", eager: true });
	const filter = process.env.FILTER;

	for (const [path, content] of Object.entries(files)) {
		const run = !filter || path.includes(filter) ? it : it.skip;

		run(`render ${path}`, async () => {
			const parsedContent = await unified()
				.use(remarkParse)
				.use(RemarkLinkToCard, { fetcher })
				.use(remarkHtml, { sanitize: false })
				.process(content);

			const rendered = [parsedContent, `<style>${CSS}</style>`]
				.join("\n")
				.trim()
				.replace(/\r\n/g, "\n");

			expect(rendered).toMatchFileSnapshot(
				path.replace("input", "output").replace(".md", ".html"),
			);
		});
	}
});
