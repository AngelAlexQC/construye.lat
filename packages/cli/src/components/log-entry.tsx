import React from "react";
import { Box, Text } from "ink";
import type { LogEntry } from "../types.ts";
import { renderMarkdown, fmtTokens, fmtCost } from "../render.ts";

const TOOL_ICONS: Record<string, string> = {
	pending: "○",
	running: "◌",
	done: "✔",
	error: "✘",
	denied: "⊘",
};

const TOOL_COLORS: Record<string, string> = {
	pending: "gray",
	running: "cyan",
	done: "green",
	error: "red",
	denied: "yellow",
};

export function LogEntryView({ entry }: { entry: LogEntry }): React.JSX.Element {
	if (entry.type === "user") {
		return (
			<Box marginTop={1}>
				<Text color="cyan" bold>{"› "}</Text>
				<Text>{entry.content}</Text>
			</Box>
		);
	}

	if (entry.type === "assistant") {
		const rendered = renderMarkdown(entry.content ?? "");
		return (
			<Box marginLeft={2} flexDirection="column">
				<Text>{rendered}</Text>
			</Box>
		);
	}

	if (entry.type === "tool-call" && entry.toolCall) {
		const tc = entry.toolCall;
		const icon = TOOL_ICONS[tc.status] ?? "?";
		const color = TOOL_COLORS[tc.status] ?? "white";
		const elapsed = tc.elapsed !== undefined ? ` ${tc.elapsed.toFixed(1)}s` : "";
		const shortArgs = tc.args.length > 60 ? `${tc.args.slice(0, 57)}...` : tc.args;

		return (
			<Box flexDirection="column" marginLeft={2}>
				<Box>
					<Text color={color}>{`${icon} `}</Text>
					<Text bold color="yellow">{tc.name}</Text>
					<Text dimColor>{` ${shortArgs}`}</Text>
					{tc.elapsed !== undefined && <Text color="green">{elapsed}</Text>}
				</Box>
				{tc.result && tc.status === "done" && (
					<Box marginLeft={4}>
						<Text dimColor wrap="truncate-end">
							{tc.result.replace(/\n/g, " ").slice(0, 120)}
						</Text>
					</Box>
				)}
				{tc.status === "error" && tc.result && (
					<Box marginLeft={4}>
						<Text color="red" wrap="truncate-end">
							{tc.result.replace(/\n/g, " ").slice(0, 120)}
						</Text>
					</Box>
				)}
			</Box>
		);
	}

	if (entry.type === "turn-metrics" && entry.metrics) {
		const m = entry.metrics;
		const parts: string[] = [`⏱ ${m.elapsed}s`];
		if (m.tokensIn !== undefined && m.tokensOut !== undefined) {
			parts.push(`${fmtTokens(m.tokensIn)}→${fmtTokens(m.tokensOut)}`);
		}
		if (m.costCents !== undefined && m.costCents > 0) {
			parts.push(fmtCost(m.costCents));
		}
		return (
			<Box marginLeft={2} marginBottom={1}>
				<Text dimColor>{`── ${parts.join("  ·  ")} ──`}</Text>
			</Box>
		);
	}

	if (entry.type === "system") {
		return (
			<Box marginLeft={2}>
				<Text color={entry.content?.startsWith("Error") ? "red" : "gray"}>
					{entry.content}
				</Text>
			</Box>
		);
	}

	return <Box />;
}
