import React from "react";

interface Props {
	content: string;
	role: "user" | "assistant" | "system";
}

export function MessageView({ content, role }: Props): React.JSX.Element {
	const color = role === "user" ? "green" : role === "assistant" ? "white" : "gray";
	const prefix = role === "user" ? "▶ " : role === "assistant" ? "◀ " : "⚙ ";

	return React.createElement("Box", { marginBottom: 1 },
		React.createElement("Text", { color }, `${prefix}${content}`),
	);
}
