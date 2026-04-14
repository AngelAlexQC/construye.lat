/**
 * WelcomeBanner — Professional intro banner with session info
 * Follows: ux-intro-outro, hashimoto progressive disclosure
 */
import React from "react";
import { Box, Text, Spacer } from "ink";
import { theme, sym, getTermWidth } from "../theme.ts";

interface WelcomeBannerProps {
	provider: string;
	model: string;
	mode: string;
	tools: number;
	dir: string;
	sessionId: string;
	isDemo: boolean;
	version: string;
}

export function WelcomeBanner({
	provider,
	model,
	mode,
	tools,
	dir,
	sessionId,
	isDemo,
	version,
}: WelcomeBannerProps): React.JSX.Element {
	const width = Math.min(getTermWidth() - 4, 64);
	const hr = sym.horizontal.repeat(width - 2);

	const modeConfig = {
		plan: { label: "Plan", icon: "📋", color: theme.info },
		auto: { label: "Auto", icon: "⚡", color: theme.success },
		interactive: { label: "Interactive", icon: "💬", color: theme.brand },
	} as const;

	const m = modeConfig[mode as keyof typeof modeConfig] ?? modeConfig.interactive;
	const shortModel = model.length > width - 20 ? model.slice(0, width - 23) + "..." : model;
	const shortDir = dir.length > width - 20 ? "..." + dir.slice(-(width - 23)) : dir;

	return (
		<Box flexDirection="column" marginBottom={1}>
			{/* Top border */}
			<Box>
				<Text color={theme.brand}>
					{sym.topLeft}{hr}{sym.topRight}
				</Text>
			</Box>

			{/* Title */}
			<Box>
				<Text color={theme.brand}>{sym.vertical} </Text>
				<Text bold color={theme.brandBold}>
					{sym.build} construye
				</Text>
				<Spacer />
				<Text dimColor>v{version}</Text>
				<Text color={theme.brand}> {sym.vertical}</Text>
			</Box>

			{/* Separator */}
			<Box>
				<Text color={theme.brand}>
					{sym.teeRight}{hr}{sym.teeLeft}
				</Text>
			</Box>

			{/* Info rows */}
			<InfoRow label="Provider" value={provider} width={width} />
			<InfoRow label="Model" value={shortModel} width={width} />
			<InfoRow label="Mode" value={`${m.icon} ${m.label}`} width={width} />
			<InfoRow label="Tools" value={String(tools)} width={width} />
			<InfoRow label="Dir" value={shortDir} width={width} />
			<InfoRow label="Session" value={sessionId.slice(0, 8)} width={width} />

			{/* Bottom border */}
			<Box>
				<Text color={theme.brand}>
					{sym.bottomLeft}{hr}{sym.bottomRight}
				</Text>
			</Box>

			{/* Demo warning */}
			{isDemo && (
				<Box flexDirection="column" marginTop={1} marginLeft={2}>
					<Text color={theme.warning}>⚠ Running in demo mode — no AI provider configured</Text>
					<Text dimColor>  Cloudflare: npx wrangler login  (auto-detects credentials)</Text>
					<Text dimColor>  Anthropic:  ANTHROPIC_API_KEY=sk-ant-...</Text>
				</Box>
			)}

			{/* Help hint */}
			<Box marginTop={1} marginLeft={2}>
				<Text dimColor>
					Type your request. <Text color={theme.brand}>Ctrl+C</Text> to exit.{" "}
					<Text color={theme.brand}>/help</Text> for commands.
				</Text>
			</Box>
		</Box>
	);
}

function InfoRow({ label, value, width }: { label: string; value: string; width: number }): React.JSX.Element {
	return (
		<Box>
			<Text color={theme.brand}>{sym.vertical} </Text>
			<Text dimColor>{label.padEnd(10)}</Text>
			<Text>{value}</Text>
			<Spacer />
			<Text color={theme.brand}>{sym.vertical}</Text>
		</Box>
	);
}
