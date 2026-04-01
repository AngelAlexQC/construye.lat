import { useState, useCallback } from "react";

export function useInputHistory() {
	const [entries, setEntries] = useState<string[]>([]);
	const [cursor, setCursor] = useState(-1);

	const push = useCallback((input: string) => {
		if (!input.trim()) return;
		setEntries((prev) => [...prev, input]);
		setCursor(-1);
	}, []);

	const up = useCallback((): string | undefined => {
		if (entries.length === 0) return undefined;
		const next = cursor === -1 ? entries.length - 1 : Math.max(0, cursor - 1);
		setCursor(next);
		return entries[next];
	}, [entries, cursor]);

	const down = useCallback((): string | undefined => {
		if (cursor === -1) return undefined;
		const next = cursor + 1;
		if (next >= entries.length) {
			setCursor(-1);
			return "";
		}
		setCursor(next);
		return entries[next];
	}, [entries, cursor]);

	const reset = useCallback(() => setCursor(-1), []);

	return { push, up, down, reset };
}
