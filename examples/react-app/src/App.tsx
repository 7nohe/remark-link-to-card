import { useEffect, useState } from "react";
import "remark-link-to-card/styles/link-card-base.css";
import output from "../output";
import "./App.css";
import { content } from "./content";
import { parse } from "./parse";

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
			<h1>remark-link-to-card works with both Node.js and browser</h1>
			<div
				style={{
					display: "flex",
					grid: "1fr 1fr",
					gap: "1rem",
				}}
			>
				<div>
					<h2>Node.js</h2>
					<div
						// biome-ignore lint/security/noDangerouslySetInnerHtml: This is a demo app
						dangerouslySetInnerHTML={{
							__html: output,
						}}
					/>
				</div>
				<div>
					<h2>Browser</h2>
					<div
						// biome-ignore lint/security/noDangerouslySetInnerHtml: This is a demo app
						dangerouslySetInnerHTML={{
							__html: html,
						}}
					/>
				</div>
			</div>
		</>
	);
}

export default App;
