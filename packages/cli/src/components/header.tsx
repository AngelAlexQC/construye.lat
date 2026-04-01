import React from "react";
import type { CliState } from "../types.js";

interface Props {
	state: CliState;
}

export function Header({ state }: Props): React.JSX.Element {
	const modeLabel = state.config.mode === "plan"
		? "📋 Plan"
		: state.config.mode === "auto"
			? "⚡ Auto"
			: "💬 Interactive";

	return React.createElement("Box", { flexDirection: "column" },
		React.createElement("Text", { bold: true, color: "cyan" },
			`🏗️  construye v0.1.0  ${modeLabel}`),
		React.createElement("Text", { dimColor: true },
			`${state.config.model} via ${state.config.provider}`),
	);
}
