/// <reference types="vite/client" />

import process from "node:process";
import remarkHtml from "remark-html";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import RemarkLinkToCard from "../src";
import cssBase from "../styles/link-card-base.css?raw";

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
				.use(RemarkLinkToCard, {})
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
