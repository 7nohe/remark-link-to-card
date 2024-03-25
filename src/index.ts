import { consola } from "consola";
import type { PhrasingContent, Root, Text } from "mdast";
import { ofetch } from "ofetch";
import ogs from "open-graph-scraper-lite";
import { parseURL } from "ufo";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

const LOG_PREFIX = "[remark-link-to-card]";

type RemarkLinkToCardOptions = {
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
	const { classPrefix = "markdown-link-card" } = options;

	return async (tree) => {
		const promises: (() => Promise<void>)[] = [];
		visit(tree, "paragraph", (node) => {
			const linkOrTextNode = node.children?.at(0);

			if (linkOrTextNode?.type !== "link" && linkOrTextNode?.type !== "text") {
				return;
			}

			let isValid = false;
			let textNode: Text | PhrasingContent | undefined;
			let url: string | undefined;

			// Check if the node is a link or text node
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

			// Check if the text node is a link
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
					const html = await ofetch(url);
					const ogData = await ogs({ html });
					const { result } = ogData;

					title = result.ogTitle ?? title;
					description = result.ogDescription ?? description;
					ogImageUrl = result.ogImage?.at(0)?.url;
				} catch (error) {
					consola.error(LOG_PREFIX, error);
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
