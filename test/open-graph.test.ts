import { describe, expect, it } from "vitest";
import { type OpenGraphMetadata, readOpenGraph } from "../src/open-graph";

/**
 * These expectations were taken from open-graph-scraper-lite, which used to do
 * this job: every case here was run through both implementations and their
 * results matched, so the table doubles as a record of the behaviour that had
 * to be preserved when the dependency was dropped.
 */
describe("readOpenGraph", () => {
	it("reads the Open Graph fields", () => {
		expect(
			readOpenGraph(
				`<html><head><meta property="og:title" content="T"><meta property="og:description" content="D"><meta property="og:image" content="I"></head></html>`,
			),
		).toEqual({ title: "T", description: "D", image: "I" });
	});

	it("falls back to <title> and the description meta tag", () => {
		expect(
			readOpenGraph(
				`<html><head><title>Page Title</title><meta name="description" content="Meta desc"></head><body><img src="https://x/hero.png"></body></html>`,
			),
		).toEqual({
			title: "Page Title",
			description: "Meta desc",
			// There is no fallback to markup in the body.
			image: undefined,
		});
	});

	it("prefers og:title over <title>", () => {
		expect(
			readOpenGraph(
				`<html><head><meta property="og:title" content="OG T"><title>Doc T</title></head></html>`,
			).title,
		).toBe("OG T");
	});

	it("reports nothing for a page carrying no metadata", () => {
		expect(readOpenGraph("<html><head></head><body></body></html>")).toEqual({
			title: undefined,
			description: undefined,
			image: undefined,
		});
	});

	it("ignores the twitter:* equivalents", () => {
		expect(
			readOpenGraph(
				`<html><head><meta name="twitter:title" content="TW"><meta name="twitter:image" content="https://x/tw.png"></head></html>`,
			),
		).toEqual({ title: undefined, description: undefined, image: undefined });
	});

	it("accepts og:image:url as a spelling of og:image", () => {
		expect(
			readOpenGraph(
				`<html><head><meta property="og:image:url" content="https://x/u.png"></head></html>`,
			).image,
		).toBe("https://x/u.png");
	});

	it("takes the first og:image but the last og:title", () => {
		expect(
			readOpenGraph(
				`<html><head><meta property="og:image" content="https://x/1.png"><meta property="og:image" content="https://x/2.png"></head></html>`,
			).image,
		).toBe("https://x/1.png");

		expect(
			readOpenGraph(
				`<html><head><meta property="og:title" content="ONE"><meta property="og:title" content="TWO"></head></html>`,
			).title,
		).toBe("TWO");
	});

	it("accepts name= and value= as well as property= and content=", () => {
		expect(
			readOpenGraph(
				`<html><head><meta name="og:title" content="NameForm"></head></html>`,
			).title,
		).toBe("NameForm");

		expect(
			readOpenGraph(
				`<html><head><meta property="og:title" value="ValueForm"></head></html>`,
			).title,
		).toBe("ValueForm");
	});

	it("leaves entity decoding to the parser", () => {
		expect(
			readOpenGraph(
				`<html><head><meta property="og:title" content="A &amp; B &lt;x&gt; &#233;"></head></html>`,
			).title,
		).toBe("A & B <x> é");
	});

	describe("attributes that are present but empty", () => {
		it("falls through to <title> when og:title is blank", () => {
			expect(
				readOpenGraph(
					`<html><head><title>Real Title</title><meta property="og:title" content=""></head></html>`,
				).title,
			).toBe("Real Title");
		});

		it("falls through to the description meta when og:description is blank", () => {
			expect(
				readOpenGraph(
					`<html><head><meta property="og:description" content=""><meta name="description" content="Real desc"></head></html>`,
				).description,
			).toBe("Real desc");
		});

		it("reads value= when content= is blank", () => {
			expect(
				readOpenGraph(
					`<html><head><meta property="og:title" content="" value="FromValue"></head></html>`,
				).title,
			).toBe("FromValue");
		});

		it("does not let a blank property= hide the name=", () => {
			expect(
				readOpenGraph(
					`<html><head><meta property="" name="og:title" content="FromName"></head></html>`,
				).title,
			).toBe("FromName");
		});
	});

	describe("more than one <title>", () => {
		it("ignores the <title> inside an inline SVG", () => {
			expect(
				readOpenGraph(
					`<html><head><title>Acme Blog</title></head><body><svg><title>Close</title></svg><svg><title>Menu</title></svg></body></html>`,
				).title,
			).toBe("Acme Blog");
		});

		it("takes the first of two <title> tags", () => {
			expect(
				readOpenGraph(
					`<html><head><title>First</title><title>Second</title></head></html>`,
				).title,
			).toBe("First");
		});
	});

	describe("og:image spellings", () => {
		it("prefers og:image even when og:image:url comes first", () => {
			expect(
				readOpenGraph(
					`<html><head><meta property="og:image:url" content="URLFORM"><meta property="og:image" content="PLAIN"></head></html>`,
				).image,
			).toBe("PLAIN");
		});

		it("uses og:image:url when there is no og:image", () => {
			expect(
				readOpenGraph(
					`<html><head><meta property="og:image:url" content="URLFORM"></head></html>`,
				).image,
			).toBe("URLFORM");
		});
	});

	it("ignores a description meta outside the head", () => {
		expect(
			readOpenGraph(
				`<html><head><title>T</title></head><body><meta name="description" content="BodyDesc"></body></html>`,
			).description,
		).toBeUndefined();
	});

	describe("noscript", () => {
		it("does not let a noscript tag override the real one", () => {
			expect(
				readOpenGraph(
					`<html><head><meta property="og:title" content="REAL"><noscript><meta property="og:title" content="NOSCRIPT"></noscript></head></html>`,
				).title,
			).toBe("REAL");
		});

		it("does not mistake a noscript tracking pixel for the page image", () => {
			expect(
				readOpenGraph(
					`<html><head><meta property="og:title" content="T"></head><body><noscript><img src="https://analytics.example/pixel.gif"><meta property="og:image" content="https://analytics.example/pixel.gif"></noscript></body></html>`,
				).image,
			).toBeUndefined();
		});

		it("keeps reading once the noscript block closes", () => {
			expect(
				readOpenGraph(
					`<html><head><noscript><meta property="og:title" content="NOSCRIPT"></noscript><meta property="og:title" content="REAL"></head></html>`,
				).title,
			).toBe("REAL");
		});
	});

	describe("the captured pages", () => {
		// Globbed rather than listed, so a page added to test/pages/ without an
		// expectation here fails instead of going quietly unchecked.
		const pages = import.meta.glob<string>("./pages/*.html", {
			query: "?raw",
			import: "default",
			eager: true,
		});

		const expected: Record<string, OpenGraphMetadata> = {
			"example.com.html": {
				title: "Example Domain",
				description: undefined,
				image: undefined,
			},
			"github.com.html": {
				title: "GitHub \u00B7 Change is constant. GitHub keeps you ahead.",
				description:
					"Join the world's most widely adopted, AI-powered developer platform where millions of developers, businesses, and the largest open source community build software that advances humanity.",
				image:
					"https://images.ctfassets.net/8aevphvgewt8/4pe4eOtUJ0ARpZRE4fNekf/f52b1f9c52f059a33170229883731ed0/GH-Homepage-Universe-img.png",
			},
			"github.com-remarkjs-remark.html": {
				title:
					"GitHub - remarkjs/remark: markdown processor powered by plugins part of the @unifiedjs collective",
				description:
					"markdown processor powered by plugins part of the @unifiedjs collective - remarkjs/remark",
				image:
					"https://opengraph.githubassets.com/55dfd97e0a4f2a4892ecd3c34733a46724ef6214872b75f0fc6f47160e17e933/remarkjs/remark",
			},
			"remark.js.org.html": {
				title: "remark",
				description: "Markdown processor powered by plugins",
				image:
					"//raw.githubusercontent.com/remarkjs/remark/website/screenshot.png",
			},
			"yarnpkg.com.html": {
				title: "Home page | Yarn",
				description: "Yarn, the modern JavaScript package manager",
				image: "https://yarnpkg.com/img/social-preview.png",
			},
		};

		for (const [filePath, html] of Object.entries(pages)) {
			const file = filePath.replace("./pages/", "");

			it(`reads ${file}`, () => {
				expect(expected, `no expectation recorded for ${file}`).toHaveProperty(
					file,
				);
				expect(readOpenGraph(html)).toEqual(expected[file]);
			});
		}
	});
});
