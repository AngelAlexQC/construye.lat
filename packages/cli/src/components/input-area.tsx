import React, { useState, useRef, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import type { AgentStatus } from "../protocol.ts";

interface Props {
	onSubmit: (text: string) => void;
	onApproval?: (approved: boolean, always?: boolean) => void;
	status: AgentStatus;
	pendingToolName?: string;
	onHistoryUp?: () => string | undefined;
	onHistoryDown?: () => string | undefined;
	onHistoryReset?: () => void;
}

export function InputArea({
	onSubmit,
	onApproval,
	status,
	pendingToolName,
	onHistoryUp,
	onHistoryDown,
	onHistoryReset,
}: Props): React.JSX.Element {
	const [input, setInput] = useState("");
	const [cursorOffset, setCursorOffset] = useState(0);
	const isIdle = status === "idle";
	const isApproval = status === "awaiting-approval";
	const isActive = isIdle || isApproval;

	// Refs for stable callback (avoids stale closures in useInput)
	const inputRef = useRef(input);
	const cursorRef = useRef(cursorOffset);
	inputRef.current = input;
	cursorRef.current = cursorOffset;

	const handleInput = useCallback(
		(char: string, key: { return?: boolean; backspace?: boolean; delete?: boolean; upArrow?: boolean; downArrow?: boolean; leftArrow?: boolean; rightArrow?: boolean; ctrl?: boolean; meta?: boolean }) => {
			if (!isActive) return;

			// ── Approval mode ──
			if (isApproval && onApproval) {
				if (char.toLowerCase() === "y" || key.return) {
					onApproval(true);
				} else if (char.toLowerCase() === "n") {
					onApproval(false);
				} else if (char.toLowerCase() === "a") {
					onApproval(true, true);
				}
				return;
			}

			const cur = inputRef.current;
			const pos = cursorRef.current;

			// ── Submit ──
			if (key.return) {
				if (cur.trim()) {
					onSubmit(cur);
					onHistoryReset?.();
					setInput("");
					setCursorOffset(0);
				}
				return;
			}

			// ── Backspace ──
			if (key.backspace || key.delete) {
				if (pos > 0) {
					setInput(cur.slice(0, pos - 1) + cur.slice(pos));
					setCursorOffset(pos - 1);
				}
				return;
			}

			// ── History navigation (Up / Down) ──
			if (key.upArrow) {
				const prev = onHistoryUp?.();
				if (prev !== undefined) {
					setInput(prev);
					setCursorOffset(prev.length);
				}
				return;
			}
			if (key.downArrow) {
				const next = onHistoryDown?.();
				if (next !== undefined) {
					setInput(next);
					setCursorOffset(next.length);
				}
				return;
			}

			// ── Cursor movement (Left / Right) ──
			if (key.leftArrow) {
				setCursorOffset(Math.max(0, pos - 1));
				return;
			}
			if (key.rightArrow) {
				setCursorOffset(Math.min(cur.length, pos + 1));
				return;
			}

			// ── Regular character input ──
			if (char && !key.ctrl && !key.meta) {
				setInput(cur.slice(0, pos) + char + cur.slice(pos));
				setCursorOffset(pos + char.length);
			}
		},
		[isActive, isApproval, onApproval, onSubmit, onHistoryUp, onHistoryDown, onHistoryReset],
	);

	useInput(handleInput, { isActive });

	// ── Approval prompt ──
	if (isApproval && pendingToolName) {
		return (
			<Box>
				<Text color="yellow">{"  ¿Permitir "}</Text>
				<Text bold color="yellow">{pendingToolName}</Text>
				<Text color="yellow">{"? "}</Text>
				<Text dimColor>{"[Y]es / [A]lways / [n]o"}</Text>
			</Box>
		);
	}

	// ── Agent working — show dimmed prompt ──
	if (!isIdle) {
		return (
			<Box>
				<Text dimColor>{"› "}</Text>
			</Box>
		);
	}

	// ── Idle — render input with inline cursor ──
	const before = input.slice(0, cursorOffset);
	const cursorChar = cursorOffset < input.length ? input[cursorOffset] : " ";
	const after = cursorOffset < input.length ? input.slice(cursorOffset + 1) : "";

	return (
		<Box>
			<Text color="cyan" bold>{"› "}</Text>
			<Text>{before}</Text>
			<Text inverse>{cursorChar}</Text>
			<Text>{after}</Text>
		</Box>
	);
}
