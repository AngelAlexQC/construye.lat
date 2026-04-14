/**
 * ToolCallView — Professional tool execution display with status tracking
 * Follows: tuicomp-box-flexbox, ux-color-semantics, tuicomp-border-styles
 */
import React from "react";
import { Box, Text } from "ink";
import { theme, sym, toolIcon, fmtElapsed } from "../theme.ts";
import type { DisplayToolCall, ToolCallStatus } from "../types.ts";

interface ToolCallViewProps {
	toolCall: DisplayToolCall;
}

const STATUS_CONFIG: Record<ToolCallStatus, { icon: string; color: string; label?: string }> = {
	pending: { icon: sym.circle, color: theme.muted, label: "pending" },
	running: { icon: sym.spinner, color: theme.toolRunning, label: "running" },
	done: { icon: sym.check, color: theme.toolDone },
	error: { icon: sym.cross, color: theme.toolError },
	denied: { icon: "⊘", color: theme.toolDenied, label: "denied" },
};

export function ToolCallDisplay({ toolCall }: ToolCallViewProps): React.JSX.Element {
	const tc = toolCall;
	const config = STATUS_CONFIG[tc.status];
	const icon = toolIcon(tc.name);
	const elapsed = tc.elapsed !== undefined ? fmtElapsed(tc.elapsed * 1000) : "";

	// Parse args for compact display
	const shortArgs = formatToolArgs(tc.name, tc.args);

	return (
		<Box flexDirection="column" marginLeft={2}>
			{/* Tool header line */}
			<Box gap={1}>
				<Text color={config.color}>{config.icon}</Text>
				<Text color={theme.toolRunning} bold>{icon} {tc.name}</Text>
				<Text dimColor>{shortArgs}</Text>
				{elapsed && <Text color={theme.muted}>{elapsed}</Text>}
			</Box>

			{/* Result preview (success) */}
			{tc.result && tc.status === "done" && (
				<Box marginLeft={4}>
					<Text dimColor wrap="truncate-end">
						{truncateResult(tc.result)}
					</Text>
				</Box>
			)}

			{/* Error message */}
			{tc.status === "error" && tc.result && (
				<Box marginLeft={4}>
					<Text color={theme.error} wrap="truncate-end">
						{sym.cross} {truncateResult(tc.result)}
					</Text>
				</Box>
			)}

			{/* Denied message */}
			{tc.status === "denied" && (
				<Box marginLeft={4}>
					<Text color={theme.toolDenied}>Tool execution denied by user</Text>
				</Box>
			)}
		</Box>
	);
}

/**
 * Format tool arguments in a compact, readable way
 * Instead of raw JSON, show the most relevant arg
 */
function formatToolArgs(name: string, argsStr: string): string {
	try {
		const args = JSON.parse(argsStr);
		// Show the most relevant field per tool type
		if (name === "read_file" || name === "write_file" || name === "edit_file") {
			return args.path || args.file_path || "";
		}
		if (name === "exec") {
			const cmd = args.command || args.cmd || "";
			return cmd.length > 60 ? cmd.slice(0, 57) + "..." : cmd;
		}
		if (name === "web_search" || name === "search_text" || name === "search_semantic") {
			return `"${args.query || args.search || ""}"`;
		}
		if (name === "web_fetch" || name === "browse") {
			return args.url || "";
		}
		if (name === "glob" || name === "list_dir") {
			return args.pattern || args.path || "";
		}
		if (name === "git") {
			return args.command || args.args?.join(" ") || "";
		}
		// Fallback: first string value
		const firstVal = Object.values(args).find((v) => typeof v === "string") as string | undefined;
		return firstVal ? (firstVal.length > 50 ? firstVal.slice(0, 47) + "..." : firstVal) : "";
	} catch {
		return argsStr.length > 60 ? argsStr.slice(0, 57) + "..." : argsStr;
	}
}

function truncateResult(result: string): string {
	const oneLine = result.replace(/\n/g, " ").trim();
	return oneLine.length > 120 ? oneLine.slice(0, 117) + "..." : oneLine;
}
