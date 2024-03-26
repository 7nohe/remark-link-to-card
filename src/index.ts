import { consola } from "consola";
import he from "he";
import type { PhrasingContent, Root, Text } from "mdast";
import { ofetch } from "ofetch";
import ogs from "open-graph-scraper-lite";
import { parseURL } from "ufo";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

const LOG_PREFIX = "[remark-link-to-card]";

type RemarkLinkToCardOptions = {
	/**
	 * Timeout for the fetch request in milliseconds.
	 *
	 * @default 5000
	 */
	timeout?: number;
	/**
	 * Prefix for the class names.
	 *
	 * @default 'markdown-link-card'
	 */
	classPrefix?: string;
};

const isValidURL = (text: string): boolean => {
	try {
		const url = new URL(text);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch (error) {
		return false;
	}
};

const RemarkLinkToCard: Plugin<RemarkLinkToCardOptions[], Root> = (
	options = {},
) => {
	const { classPrefix = "markdown-link-card", timeout = 5000 } = options;

	return async (tree) => {
		const promises: (() => Promise<void>)[] = [];
		visit(tree, "paragraph", (node, _, parent) => {
			// Check if the parent is a root node
			if (parent?.type !== "root") {
				return;
			}

			// Check if the paragraph has only one child
			if (node.children.length !== 1) {
				return;
			}

			const linkOrTextNode = node.children?.at(0);

			// Check if the child is a link or text node
			if (linkOrTextNode?.type !== "link" && linkOrTextNode?.type !== "text") {
				return;
			}

			let isValid = false;
			let textNode: Text | PhrasingContent | undefined;
			let url: string | undefined;

			switch (linkOrTextNode.type) {
				case "link":
					textNode = linkOrTextNode.children?.at(0);
					isValid = isValidURL(linkOrTextNode.url);
					url = linkOrTextNode.url;
					break;
				case "text":
					textNode = linkOrTextNode;
					isValid = isValidURL(linkOrTextNode.value);
					url = linkOrTextNode.value;
					break;
			}

			if (textNode?.type !== "text") {
				return;
			}

			// Check if the URL is valid
			if (!isValid) {
				return;
			}

			if (url === undefined) {
				return;
			}

			let title = textNode.value ?? url;
			const { host } = parseURL(url);

			promises.push(async () => {
				let description = "";
				let ogImageUrl: string | undefined;

				try {
					const raw = await ofetch.raw<string>(url, {
						timeout,
					});
					const contentType = raw.headers.get("content-type");

					// Only process HTML content
					if (contentType?.indexOf("text/html") === -1) {
						throw new Error("Content type is not HTML");
					}

					const html = raw._data;

					if (html === undefined || html === "") {
						throw new Error("HTML content is empty");
					}

					const ogData = await ogs({ html });
					const { result } = ogData;

					if (result.success === false) {
						throw new Error(result.errorDetails?.message);
					}

					title = he.encode(result.ogTitle ?? title);
					description = he.encode(result.ogDescription ?? description);
					ogImageUrl = result.ogImage?.at(0)?.url;
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "An error occurred";
					consola.error(LOG_PREFIX, message);
				}

				node.data = {
					hName: "a",
					hProperties: {
						class: `${classPrefix}-link`,
						href: url,
						target: "_blank",
						rel: "noopener noreferrer nofollow",
					},
				};

				const thumbnail = ogImageUrl
					? `
  <div class="${classPrefix}-thumbnail">
    <img src="${ogImageUrl}" alt="${title}" class="${classPrefix}-thumbnail-image">
  </div>
`
					: "";

				node.children = [
					{
						type: "html",
						value: `
  <div class="${classPrefix}-main">
    <div class="${classPrefix}-title">${title}</div>
    <div class="${classPrefix}-description">
      ${description}
    </div>
    <div class="${classPrefix}-meta">
      <img class="${classPrefix}-favicon" src="https://www.google.com/s2/favicons?domain=${host}" alt="${host} favicon image" width="14" height="14">
      ${host}
    </div>
  </div>
  ${thumbnail}
            `,
					},
				];
			});
		});

		try {
			await Promise.all(promises.map((promise) => promise()));
		} catch (error) {
			consola.error(LOG_PREFIX, error);
		}
		return tree;
	};
};
export default RemarkLinkToCard;
