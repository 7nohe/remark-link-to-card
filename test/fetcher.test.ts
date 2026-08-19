import remarkHtml from "remark-html";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import RemarkLinkToCard, { type LinkCardFetcher } from "../src";

const MARKDOWN = "https://example.com/article\n";

const OG_HTML = `
<!doctype html>
<html>
  <head>
    <meta property="og:title" content="Injected title" />
    <meta property="og:description" content="Injected description" />
    <meta property="og:image" content="https://example.com/og.png" />
  </head>
  <body></body>
</html>
`;

const render = async (fetcher: LinkCardFetcher, timeout?: number) => {
	const file = await unified()
		.use(remarkParse)
		.use(RemarkLinkToCard, { fetcher, ...(timeout ? { timeout } : {}) })
		.use(remarkHtml, { sanitize: false })
		.process(MARKDOWN);

	return String(file);
};

describe("fetcher option", () => {
	it("builds the card from the HTML the fetcher returns", async () => {
		const html = await render(async () => OG_HTML);

		expect(html).toContain("Injected title");
		expect(html).toContain("Injected description");
		expect(html).toContain("https://example.com/og.png");
	});

	it("passes the url and the resolved timeout to the fetcher", async () => {
		const calls: Array<{ url: string; timeout: number }> = [];

		await render(async (url, context) => {
			calls.push({ url, timeout: context.timeout });
			return OG_HTML;
		}, 1234);

		expect(calls).toEqual([
			{ url: "https://example.com/article", timeout: 1234 },
		]);
	});

	it("defaults the timeout when the option is omitted", async () => {
		const calls: number[] = [];

		await render(async (_url, context) => {
			calls.push(context.timeout);
			return OG_HTML;
		});

		expect(calls).toEqual([5000]);
	});

	it("falls back to the link text when the fetcher throws", async () => {
		const html = await render(async () => {
			throw new Error("proxy unavailable");
		});

		// The card is still emitted, carrying the URL as its title.
		expect(html).toContain("markdown-link-card-link");
		expect(html).toContain("https://example.com/article");
		expect(html).not.toContain("Injected title");
	});

	it("falls back to the link text when the fetcher returns nothing", async () => {
		const html = await render(async () => undefined);

		expect(html).toContain("markdown-link-card-link");
		expect(html).not.toContain("Injected title");
	});
});
