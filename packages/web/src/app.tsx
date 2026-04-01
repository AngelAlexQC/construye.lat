import React, { useState } from "react";

export function App(): React.JSX.Element {
	const [connected, setConnected] = useState(false);

	return (
		<div className="min-h-screen bg-zinc-950 text-white flex flex-col">
			<header className="border-b border-zinc-800 p-4 flex items-center gap-3">
				<h1 className="text-lg font-bold">🏗️ construye.lat</h1>
				<span className="text-zinc-500 text-sm">v0.1.0</span>
				<div className="ml-auto">
					<span className={`text-xs ${connected ? "text-green-400" : "text-zinc-500"}`}>
						{connected ? "● Conectado" : "○ Desconectado"}
					</span>
				</div>
			</header>

			<main className="flex-1 flex items-center justify-center">
				<div className="text-center text-zinc-500">
					<p className="text-2xl mb-2">🚧</p>
					<p>Interfaz web en construcción</p>
					<p className="text-sm mt-1">Usa el CLI: <code className="text-cyan-400">construye</code></p>
				</div>
			</main>
		</div>
	);
}
