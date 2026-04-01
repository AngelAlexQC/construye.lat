import React from "react";

interface Props {
	inputTokens: number;
	outputTokens: number;
	costUsd: number;
	turnsUsed: number;
}

export function StatusBar({ inputTokens, outputTokens, costUsd, turnsUsed }: Props): React.JSX.Element {
	const tokens = `${(inputTokens / 1000).toFixed(1)}k in / ${(outputTokens / 1000).toFixed(1)}k out`;
	const cost = `$${costUsd.toFixed(4)}`;

	return React.createElement("Box", { borderStyle: "single", paddingX: 1 },
		React.createElement("Text", { dimColor: true },
			`Tokens: ${tokens}  |  Costo: ${cost}  |  Turnos: ${turnsUsed}`),
	);
}
