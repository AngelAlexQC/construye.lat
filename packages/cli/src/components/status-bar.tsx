import React from "react";
import { Box, Text } from "ink";
import { fmtTokens, fmtCost } from "../render.ts";
import type { AgentStatus } from "../protocol.ts";

interface Props {
	model: string;
	provider: string;
	sessionId: string;
	tokensIn: number;
	tokensOut: number;
	costCents: number;
	turns: number;
	status: AgentStatus;
}

const STATUS_LABELS: Record<AgentStatus, string> = {
	idle: "",
	thinking: "pensando...",
	streaming: "escribiendo...",
	"tool-calling": "ejecutando...",
	"awaiting-approval": "esperando aprobación",
};

export function StatusBar({
	model,
	sessionId,
	tokensIn,
	tokensOut,
	costCents,
	status,
}: Props): React.JSX.Element {
	const statusLabel = STATUS_LABELS[status];
	const hasStats = tokensIn > 0 || tokensOut > 0;
	const shortModel = model.length > 20 ? `${model.slice(0, 17)}...` : model;

	return (
		<Box borderStyle="single" borderColor="gray" paddingX={1} justifyContent="space-between">
			<Box gap={2}>
				<Text dimColor>{shortModel}</Text>
				{hasStats && (
					<Text dimColor>
						{`${fmtTokens(tokensIn)}→${fmtTokens(tokensOut)}`}
						{costCents > 0 ? `  ${fmtCost(costCents)}` : ""}
					</Text>
				)}
			</Box>
			<Box gap={2}>
				{statusLabel ? <Text color="cyan">{statusLabel}</Text> : null}
				<Text dimColor>{sessionId.slice(0, 8)}</Text>
			</Box>
		</Box>
	);
}
