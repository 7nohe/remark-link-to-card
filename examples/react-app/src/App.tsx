import { useEffect, useState } from "react";
import "remark-link-to-card/styles/link-card-base.css";
import "./App.css";
import { parse } from "./parse";

const content = `
## Links

https://react.dev/

[GitHub](https://github.com/)

https://pnpm.io/

[Yarn](https://yarnpkg.com/)

https://nextjs.org/docs

[remark](https://remark.js.org/)

This is a [link](https://github.com/).

This is a sentence with a [link](https://example.com) inside.
`;

function App() {
	const [html, setHtml] = useState("");

	useEffect(() => {
		(async () => {
			const html = await parse(content);
			setHtml(html.toString());
		})();
	}, []);

	return (
		<>
			<div
				// biome-ignore lint/security/noDangerouslySetInnerHtml: This is a demo app
				dangerouslySetInnerHTML={{
					__html: html,
				}}
			/>
		</>
	);
}

export default App;
