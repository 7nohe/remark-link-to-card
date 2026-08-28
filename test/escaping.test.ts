import remarkHtml from "remark-html";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import RemarkLinkToCard, { type LinkCardFetcher } from "../src";

const render = async (
	markdown: string,
	fetcher: LinkCardFetcher,
	classPrefix?: string,
) => {
	const file = await unified()
		.use(remarkParse)
		.use(RemarkLinkToCard, { fetcher, ...(classPrefix ? { classPrefix } : {}) })
		.use(remarkHtml, { sanitize: false })
		.process(markdown);

	return String(file);
};

const MARKDOWN = "https://example.com/article\n";

const pageWith = (ogImage: string) => `
<!doctype html>
<html>
  <head>
    <meta property="og:title" content="Title" />
    <meta property="og:image" content=${ogImage} />
  </head>
  <body></body>
</html>
`;

/**
 * The linked page is somebody else's, so its Open Graph values are attacker
 * input as far as the card is concerned. They end up in a raw HTML node, and
 * htmlparser2 hands them over with their entities already decoded — so a value
 * the remote page wrote as `&quot;` is a bare quote by the time it is
 * interpolated, and escaping it again here is what keeps it inside the
 * attribute.
 */
describe("escaping", () => {
	it("keeps a quote in og:image inside the src attribute", async () => {
		const html = await render(MARKDOWN, async () =>
			// Single-quoted so the quote reaches the plugin raw.
			pageWith(`'https://example.com/x.png" onerror="alert(1)'`),
		);

		expect(html).toContain("&#x22; onerror=&#x22;");
		// A real quote here would mean the attribute was broken out of.
		expect(html).not.toMatch(/onerror\s*=\s*"/);
	});

	it("keeps an entity-escaped quote in og:image inside the src attribute", async () => {
		const html = await render(MARKDOWN, async () =>
			pageWith(`"https://example.com/x.png&quot; onerror=&quot;alert(1)"`),
		);

		expect(html).toContain("&#x22; onerror=&#x22;");
		expect(html).not.toMatch(/onerror\s*=\s*"/);
	});

	it("keeps a tag in og:image inside the src attribute", async () => {
		const html = await render(MARKDOWN, async () =>
			pageWith(`'https://example.com/x.png"><script>alert(1)</script>'`),
		);

		expect(html).toContain("&#x3C;script&#x3E;");
		expect(html).not.toContain("<script");
	});

	it("escapes the og:title it puts in the thumbnail alt", async () => {
		const html = await render(
			MARKDOWN,
			async () => `
<meta property="og:title" content='" onerror="alert(1)' />
<meta property="og:image" content="https://example.com/x.png" />
`,
		);

		expect(html).toContain("&#x22; onerror=&#x22;");
		expect(html).not.toMatch(/onerror\s*=\s*"/);
	});

	it("escapes the class prefix it is configured with", async () => {
		const html = await render(
			MARKDOWN,
			async () => pageWith('"https://example.com/x.png"'),
			'x" onmouseover="alert(1)',
		);

		expect(html).toContain("&#x22; onmouseover=&#x22;");
		expect(html).not.toMatch(/onmouseover\s*=\s*"/);
	});

	it("escapes the link text it falls back to when the fetch fails", async () => {
		const html = await render(
			'https://example.com/a"onerror="alert(1)\n',
			async () => {
				throw new Error("proxy unavailable");
			},
		);

		// The URL is kept verbatim rather than normalised, so its quotes reach
		// the card even though `new URL()` accepted it.
		expect(html).toContain("&#x22;onerror=&#x22;");
		expect(html).not.toMatch(/onerror\s*=\s*"/);
	});
});
