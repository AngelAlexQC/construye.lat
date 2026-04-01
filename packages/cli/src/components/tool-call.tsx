import React from "react";

interface Props {
	toolName: string;
	status: "running" | "done" | "error";
	output?: string;
}

export function ToolCallView({ toolName, status, output }: Props): React.JSX.Element {
	const icon = status === "running" ? "⏳" : status === "done" ? "✅" : "❌";

	return React.createElement("Box", { flexDirection: "column", marginLeft: 2 },
		React.createElement("Text", { dimColor: true }, `${icon} ${toolName}`),
		output
			? React.createElement("Text", { dimColor: true, wrap: "truncate-end" }, output)
			: null,
	);
}
