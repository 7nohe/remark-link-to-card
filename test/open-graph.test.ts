import fs from "node:fs";
import path from "node:path";
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
		const pagesDir = path.resolve(__dirname, "pages");

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

		for (const [file, want] of Object.entries(expected)) {
			it(`reads ${file}`, () => {
				const html = fs.readFileSync(path.join(pagesDir, file), "utf8");
				expect(readOpenGraph(html)).toEqual(want);
			});
		}
	});
});
