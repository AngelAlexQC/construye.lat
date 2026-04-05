/**
 * ThinkingIndicator — Animated spinner with elapsed time
 * Follows: render-60fps-baseline, ux-progress-indicators, render-overwrite-dont-clear
 */
import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { Spinner } from "@inkjs/ui";
import { theme, fmtElapsed } from "../theme.ts";
import type { AgentStatus } from "../protocol.ts";

interface ThinkingIndicatorProps {
	status: AgentStatus;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
	thinking: { label: "Thinking", color: theme.thinking },
	"tool-calling": { label: "Running tool", color: theme.toolRunning },
	streaming: { label: "Writing", color: theme.streaming },
};

export function ThinkingIndicator({ status }: ThinkingIndicatorProps): React.JSX.Element | null {
	const [startTime] = useState(() => Date.now());
	const [elapsed, setElapsed] = useState(0);

	useEffect(() => {
		const timer = setInterval(() => {
			setElapsed(Date.now() - startTime);
		}, 100);
		return () => clearInterval(timer);
	}, [startTime]);

	const config = STATUS_CONFIG[status];
	if (!config) return null;

	return (
		<Box marginLeft={2} gap={1}>
			<Spinner label="" />
			<Text color={config.color}>{config.label}</Text>
			<Text dimColor>{fmtElapsed(elapsed)}</Text>
		</Box>
	);
}
