import remarkHtml from "remark-html";
import remarkLinkToCard from "remark-link-to-card";
import remarkParse from "remark-parse";
import { unified } from "unified";

const prosessor = await unified()
	.use(remarkParse)
	.use(remarkHtml, { sanitize: false })
	.use(remarkLinkToCard);

export function parse(content: string) {
	return prosessor.process(content);
}
