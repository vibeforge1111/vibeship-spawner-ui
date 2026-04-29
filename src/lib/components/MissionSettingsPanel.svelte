<script lang="ts">
	import type {
		MultiLLMCapability,
		MultiLLMProviderConfig,
		MultiLLMStrategy
	} from '$lib/services/multi-llm-orchestrator';

	interface Props {
		showMissionSettings: boolean;
		missionName: string;
		missionDescription: string;
		projectPath: string;
		projectType: string;
		goalsText: string;
		multiLLMEnabled: boolean;
		multiLLMStrategy: MultiLLMStrategy;
		multiLLMPrimaryProviderId: string;
		multiLLMAutoEnableByKeys: boolean;
		multiLLMAutoRouteByTask: boolean;
		multiLLMAutoDispatch: boolean;
		showAdvancedMultiLLM: boolean;
		multiLLMApiKeys: Record<string, string>;
		serverProviderKeyPresence: Record<string, boolean>;
		connectedMcpCapabilities: MultiLLMCapability[];
		connectedMcpToolCount: number;
		multiLLMProviders: MultiLLMProviderConfig[];
		hasDualProviderKeys: () => boolean;
		getExecutionMode: () => 'single' | 'multi';
		setExecutionMode: (mode: 'single' | 'multi') => void;
		toggleMultiLLMProvider: (providerId: string) => void;
		updateMultiLLMProviderModel: (providerId: string, model: string) => void;
		updateMultiLLMApiKey: (providerId: string, apiKey: string) => void;
		persistDefaults: () => void;
	}

	let {
		showMissionSettings = $bindable(),
		missionName = $bindable(),
		missionDescription = $bindable(),
		projectPath = $bindable(),
		projectType = $bindable(),
		goalsText = $bindable(),
		multiLLMEnabled = $bindable(),
		multiLLMStrategy = $bindable(),
		multiLLMPrimaryProviderId = $bindable(),
		multiLLMAutoEnableByKeys = $bindable(),
		multiLLMAutoRouteByTask = $bindable(),
		multiLLMAutoDispatch = $bindable(),
		showAdvancedMultiLLM = $bindable(),
		multiLLMApiKeys,
		serverProviderKeyPresence,
		connectedMcpCapabilities,
		connectedMcpToolCount,
		multiLLMProviders,
		hasDualProviderKeys,
		getExecutionMode,
		setExecutionMode,
		toggleMultiLLMProvider,
		updateMultiLLMProviderModel,
		updateMultiLLMApiKey,
		persistDefaults
	}: Props = $props();
</script>

<div class="px-4 py-3 border-t border-surface-border bg-bg-tertiary">
	<div class="flex items-center justify-between">
		<div class="text-xs font-mono text-text-tertiary uppercase tracking-wider">
			Mission Settings
		</div>
		<button
			onclick={() => (showMissionSettings = !showMissionSettings)}
			class="text-xs font-mono text-accent-primary hover:text-accent-primary-hover transition-colors"
		>
			{showMissionSettings ? 'Hide' : 'Show'}
		</button>
	</div>

	{#if showMissionSettings}
		<div class="mt-3 grid grid-cols-1 gap-3">
			<label class="block">
				<div class="text-xs font-mono text-text-tertiary mb-1">Mission Name</div>
				<input class="input" bind:value={missionName} placeholder="Spark Intelligence Launch Readiness" />
			</label>

			<label class="block">
				<div class="text-xs font-mono text-text-tertiary mb-1">Project Path</div>
				<input class="input" bind:value={projectPath} placeholder="C:/path/to/repo" />
			</label>

			<label class="block">
				<div class="text-xs font-mono text-text-tertiary mb-1">Project Type</div>
				<input class="input" bind:value={projectType} placeholder="tool | saas | marketplace | general" />
			</label>

			<label class="block">
				<div class="text-xs font-mono text-text-tertiary mb-1">Mission Description</div>
				<textarea
					class="input"
					rows="2"
					bind:value={missionDescription}
					placeholder="What success looks like for this run..."
				></textarea>
			</label>

			<label class="block">
				<div class="text-xs font-mono text-text-tertiary mb-1">Goals (one per line)</div>
				<textarea class="input" rows="3" bind:value={goalsText}></textarea>
			</label>

			<div class="p-3 border border-surface-border bg-bg-primary">
				<div class="flex items-center justify-between">
					<div class="text-xs font-mono text-text-tertiary uppercase tracking-wider">
						Multi-LLM Orchestrator
					</div>
					<label class="flex items-center gap-2 text-xs text-text-secondary">
						<input
							type="checkbox"
							checked={multiLLMEnabled}
							onchange={(event) =>
								(multiLLMEnabled = (event.currentTarget as HTMLInputElement).checked)}
						/>
						Enable
					</label>
				</div>

				{#if hasDualProviderKeys()}
					<div class="mt-2 p-2 border border-vibe-teal/30 bg-vibe-teal/10 text-xs text-vibe-teal font-mono">
						Run flow will auto-launch Codex + Claude in parallel consensus mode.
					</div>
				{/if}

				<div class="mt-3 p-2 border border-surface-border bg-bg-tertiary">
					<div class="text-xs font-mono text-text-tertiary mb-1">Execution Mode</div>
					<div class="grid grid-cols-2 gap-2">
						<button
							type="button"
							class="px-2 py-1 text-xs font-mono border transition-colors {getExecutionMode() === 'single' ? 'border-accent-primary text-accent-primary bg-accent-primary/10' : 'border-surface-border text-text-secondary hover:text-text-primary'}"
							onclick={() => setExecutionMode('single')}
						>
							Single LLM
						</button>
						<button
							type="button"
							class="px-2 py-1 text-xs font-mono border transition-colors {getExecutionMode() === 'multi' ? 'border-accent-primary text-accent-primary bg-accent-primary/10' : 'border-surface-border text-text-secondary hover:text-text-primary'}"
							onclick={() => setExecutionMode('multi')}
						>
							Multi LLM
						</button>
					</div>
					<div class="mt-2 flex justify-end">
						<button
							type="button"
							class="text-[11px] font-mono text-text-tertiary hover:text-text-secondary"
							onclick={() => (showAdvancedMultiLLM = !showAdvancedMultiLLM)}
						>
							{showAdvancedMultiLLM ? 'Hide Advanced' : 'Show Advanced'}
						</button>
					</div>
				</div>

				{#if multiLLMEnabled && showAdvancedMultiLLM}
					<div class="mt-2 grid grid-cols-1 gap-2">
						<div class="grid grid-cols-2 gap-2">
							<label class="flex items-center gap-2 text-xs text-text-secondary p-2 border border-surface-border">
								<input
									type="checkbox"
									checked={multiLLMAutoEnableByKeys}
									onchange={(event) =>
										(multiLLMAutoEnableByKeys = (event.currentTarget as HTMLInputElement).checked)}
								/>
								Auto-enable configured providers
							</label>
							<label class="flex items-center gap-2 text-xs text-text-secondary p-2 border border-surface-border">
								<input
									type="checkbox"
									checked={multiLLMAutoRouteByTask}
									onchange={(event) =>
										(multiLLMAutoRouteByTask = (event.currentTarget as HTMLInputElement).checked)}
								/>
								Auto-route by task type
							</label>
							<label class="flex items-center gap-2 text-xs text-text-secondary p-2 border border-green-600/30 bg-green-600/5">
								<input
									type="checkbox"
									checked={multiLLMAutoDispatch}
									onchange={(event) =>
										(multiLLMAutoDispatch = (event.currentTarget as HTMLInputElement).checked)}
								/>
								Direct run (no copy/paste)
							</label>
						</div>

						<label class="block">
							<div class="text-xs font-mono text-text-tertiary mb-1">Strategy</div>
							<select
								class="input"
								value={multiLLMStrategy}
								onchange={(event) =>
									(multiLLMStrategy = (event.currentTarget as HTMLSelectElement).value as MultiLLMStrategy)}
							>
								<option value="single">Single</option>
								<option value="round_robin">Round Robin</option>
								<option value="parallel_consensus">Parallel Consensus</option>
								<option value="lead_reviewer">Lead + Reviewers</option>
							</select>
						</label>

						<div class="p-2 border border-surface-border bg-bg-tertiary">
							<div class="text-xs font-mono text-text-tertiary mb-1">Connected MCP Capabilities</div>
							<div class="text-xs text-text-secondary">
								{connectedMcpCapabilities.length > 0
									? connectedMcpCapabilities.join(', ')
									: 'No connected MCP capabilities detected'}
							</div>
							<div class="text-[11px] text-text-tertiary mt-1">
								Detected tools: {connectedMcpToolCount}
							</div>
						</div>

						<label class="block">
							<div class="text-xs font-mono text-text-tertiary mb-1">Primary Provider</div>
							<select
								class="input"
								value={multiLLMPrimaryProviderId}
								onchange={(event) =>
									(multiLLMPrimaryProviderId = (event.currentTarget as HTMLSelectElement).value)}
							>
								{#each multiLLMProviders.filter((provider) => provider.enabled) as provider}
									<option value={provider.id}>{provider.label}</option>
								{/each}
							</select>
						</label>

						<div>
							<div class="text-xs font-mono text-text-tertiary mb-1">Providers</div>
							<div class="space-y-1">
								{#each multiLLMProviders as provider}
									<div class="flex items-center gap-2 p-2 border border-surface-border">
										<label class="flex items-center gap-2 min-w-28">
											<input
												type="checkbox"
												checked={provider.enabled}
												onchange={() => toggleMultiLLMProvider(provider.id)}
											/>
											<span class="text-xs font-mono text-text-secondary">{provider.label}</span>
											{#if serverProviderKeyPresence[provider.id] && !multiLLMApiKeys[provider.id]}
												<span class="text-[10px] font-mono text-accent-primary">env</span>
											{/if}
										</label>
										<input
											class="input flex-1 !py-1"
											value={provider.model}
											oninput={(event) =>
												updateMultiLLMProviderModel(
													provider.id,
													(event.currentTarget as HTMLInputElement).value
												)}
											placeholder="Model"
										/>
										{#if provider.apiKeyEnv}
											<input
												type="password"
												class="input flex-1 !py-1"
												value={multiLLMApiKeys[provider.id] || ''}
												oninput={(event) =>
													updateMultiLLMApiKey(
														provider.id,
														(event.currentTarget as HTMLInputElement).value
													)}
												placeholder={`${provider.apiKeyEnv} (local only)`}
											/>
										{/if}
									</div>
								{/each}
							</div>
							<p class="mt-1 text-[11px] text-text-tertiary">
								Browser keys override server env keys. Server-side key presence is used for readiness only.
							</p>
						</div>
					</div>
				{/if}
			</div>

			<div class="flex items-center justify-between">
				<div class="text-xs text-text-tertiary">
					Saved locally on Run.
				</div>
				<button
					onclick={persistDefaults}
					class="px-3 py-1.5 text-xs font-mono text-text-secondary border border-surface-border hover:border-text-tertiary rounded-md transition-all"
				>
					Save Now
				</button>
			</div>
		</div>
	{/if}
</div>
