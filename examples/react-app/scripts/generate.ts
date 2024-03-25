import { writeFile } from "node:fs/promises";
import { content } from "../src/content";
import { parse } from "../src/parse";

export const generateHtml = async (content: string) => {
	const html = await parse(content);

	await writeFile(
		"output.ts",
		`
export default \`${html}\`;
`,
	);
	console.log("HTML file generated");
};

generateHtml(content);
