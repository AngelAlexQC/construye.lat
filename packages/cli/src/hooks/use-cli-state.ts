import { useState, useCallback } from "react";
import type { CliState, CliConfig } from "../types.js";
import { DEFAULT_CLI_CONFIG } from "../types.js";

export function useCliState(initialConfig?: Partial<CliConfig>): {
	state: CliState;
	setRunning: (running: boolean) => void;
	setSessionId: (id: string) => void;
	setInput: (input: string) => void;
} {
	const [state, setState] = useState<CliState>({
		config: { ...DEFAULT_CLI_CONFIG, ...initialConfig },
		sessionId: null,
		isRunning: false,
		inputBuffer: "",
	});

	const setRunning = useCallback((isRunning: boolean) => {
		setState((s) => ({ ...s, isRunning }));
	}, []);

	const setSessionId = useCallback((sessionId: string) => {
		setState((s) => ({ ...s, sessionId }));
	}, []);

	const setInput = useCallback((inputBuffer: string) => {
		setState((s) => ({ ...s, inputBuffer }));
	}, []);

	return { state, setRunning, setSessionId, setInput };
}
