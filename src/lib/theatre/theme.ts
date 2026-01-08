/**
 * Theatre Design System Tokens
 *
 * Cyberpunk-inspired design tokens following the H70 design-systems pattern:
 * Three-tier architecture: Primitive → Semantic → Component tokens
 */

// ============================================
// TIER 1: Primitive Tokens (Raw Values)
// ============================================

export const primitives = {
	// Colors - Cyberpunk Palette
	colors: {
		// Neutrals (dark-to-light)
		black: '#000000',
		gray900: '#0a0a0f',
		gray800: '#111116',
		gray700: '#1a1a2e',
		gray600: '#252538',
		gray500: '#3a3a4d',
		gray400: '#5a5a6d',
		gray300: '#8a8a9d',
		gray200: '#b0b0c0',
		gray100: '#e0e0e8',
		white: '#ffffff',

		// Accent Colors
		cyan: '#00ffff',
		cyanDark: '#00cccc',
		cyanLight: '#66ffff',

		magenta: '#ff00ff',
		magentaDark: '#cc00cc',
		magentaLight: '#ff66ff',

		// Agent Role Colors
		indigo: '#6366F1',
		pink: '#EC4899',
		emerald: '#10B981',
		purple: '#8B5CF6',
		amber: '#F59E0B',
		teal: '#06B6D4',
		red: '#EF4444',

		// Status Colors
		success: '#10B981',
		warning: '#F59E0B',
		error: '#EF4444',
		info: '#06B6D4'
	},

	// Spacing
	spacing: {
		'0': '0',
		'1': '0.25rem',
		'2': '0.5rem',
		'3': '0.75rem',
		'4': '1rem',
		'5': '1.25rem',
		'6': '1.5rem',
		'8': '2rem',
		'10': '2.5rem',
		'12': '3rem',
		'16': '4rem',
		'20': '5rem',
		'24': '6rem'
	},

	// Typography
	fontFamily: {
		sans: 'Inter, system-ui, -apple-system, sans-serif',
		mono: 'JetBrains Mono, Fira Code, monospace'
	},

	fontSize: {
		xs: '0.75rem',
		sm: '0.875rem',
		base: '1rem',
		lg: '1.125rem',
		xl: '1.25rem',
		'2xl': '1.5rem',
		'3xl': '2rem',
		'4xl': '2.5rem'
	},

	fontWeight: {
		normal: '400',
		medium: '500',
		semibold: '600',
		bold: '700'
	},

	// Borders
	borderRadius: {
		none: '0',
		sm: '2px',
		md: '4px',
		lg: '8px',
		full: '9999px'
	},

	borderWidth: {
		'0': '0',
		'1': '1px',
		'2': '2px',
		'4': '4px'
	},

	// Shadows
	shadow: {
		none: 'none',
		sm: '0 1px 2px rgba(0, 0, 0, 0.5)',
		md: '0 4px 6px rgba(0, 0, 0, 0.5)',
		lg: '0 10px 15px rgba(0, 0, 0, 0.5)',
		glow: '0 0 20px rgba(0, 255, 255, 0.3)',
		glowMagenta: '0 0 20px rgba(255, 0, 255, 0.3)'
	},

	// Transitions
	transition: {
		fast: '150ms ease',
		normal: '200ms ease',
		slow: '300ms ease'
	}
} as const;

// ============================================
// TIER 2: Semantic Tokens (Purpose-Based)
// ============================================

export const semantic = {
	// Surfaces
	surface: {
		primary: primitives.colors.gray900,
		secondary: primitives.colors.gray800,
		tertiary: primitives.colors.gray700,
		elevated: primitives.colors.gray600,
		overlay: 'rgba(0, 0, 0, 0.7)'
	},

	// Borders
	border: {
		default: primitives.colors.gray700,
		subtle: primitives.colors.gray800,
		strong: primitives.colors.gray500,
		accent: primitives.colors.cyan
	},

	// Text
	text: {
		primary: primitives.colors.gray100,
		secondary: primitives.colors.gray300,
		muted: primitives.colors.gray400,
		inverse: primitives.colors.gray900,
		accent: primitives.colors.cyan
	},

	// Accents
	accent: {
		primary: primitives.colors.cyan,
		secondary: primitives.colors.magenta,
		gradient: `linear-gradient(90deg, ${primitives.colors.cyan}, ${primitives.colors.magenta})`
	},

	// Status
	status: {
		success: primitives.colors.success,
		warning: primitives.colors.warning,
		error: primitives.colors.error,
		info: primitives.colors.info
	},

	// Agent Colors
	agent: {
		planner: primitives.colors.indigo,
		frontend: primitives.colors.pink,
		backend: primitives.colors.emerald,
		database: primitives.colors.purple,
		testing: primitives.colors.amber,
		devops: primitives.colors.teal,
		security: primitives.colors.red
	}
} as const;

// ============================================
// TIER 3: Component Tokens (Specific Use)
// ============================================

export const components = {
	// Theatre Canvas
	canvas: {
		background: semantic.surface.primary,
		fog: semantic.surface.primary,
		gridColor: primitives.colors.cyan,
		gridColorSecondary: semantic.surface.tertiary
	},

	// Characters
	character: {
		bodyMetalness: 0.3,
		bodyRoughness: 0.7,
		headMetalness: 0.5,
		headRoughness: 0.3,
		emissiveIntensity: 0.2,
		ringOpacity: 0.8
	},

	// Header
	header: {
		background: semantic.surface.secondary,
		height: '56px',
		borderColor: semantic.border.default
	},

	// Side Panel
	sidePanel: {
		width: '320px',
		background: semantic.surface.secondary,
		borderColor: semantic.border.default
	},

	// Cards
	card: {
		background: semantic.surface.tertiary,
		border: semantic.border.default,
		padding: primitives.spacing['4']
	},

	// Buttons
	button: {
		primary: {
			background: semantic.accent.primary,
			text: semantic.text.inverse,
			hover: primitives.colors.cyanDark
		},
		secondary: {
			background: semantic.surface.tertiary,
			text: semantic.text.primary,
			border: semantic.border.default,
			hover: semantic.surface.elevated
		},
		ghost: {
			background: 'transparent',
			text: semantic.text.secondary,
			hover: semantic.surface.tertiary
		}
	},

	// Progress Bar
	progressBar: {
		background: semantic.surface.tertiary,
		fill: semantic.accent.gradient,
		height: '24px'
	},

	// Log Entry
	logEntry: {
		background: semantic.surface.tertiary,
		padding: primitives.spacing['2'],
		fontSize: primitives.fontSize.xs,
		successBorder: semantic.status.success,
		errorBorder: semantic.status.error,
		infoBorder: semantic.status.info
	},

	// Agent Chip
	agentChip: {
		background: semantic.surface.tertiary,
		fontSize: primitives.fontSize.xs,
		padding: `${primitives.spacing['2']} ${primitives.spacing['3']}`,
		dotSize: '6px'
	}
} as const;

// ============================================
// CSS Custom Properties Generator
// ============================================

export function generateCSSVariables(): string {
	const lines: string[] = [':root {'];

	// Surface colors
	lines.push('  /* Surfaces */');
	lines.push(`  --surface-primary: ${semantic.surface.primary};`);
	lines.push(`  --surface-secondary: ${semantic.surface.secondary};`);
	lines.push(`  --surface-tertiary: ${semantic.surface.tertiary};`);
	lines.push(`  --surface-elevated: ${semantic.surface.elevated};`);
	lines.push(`  --surface-overlay: ${semantic.surface.overlay};`);

	// Borders
	lines.push('  /* Borders */');
	lines.push(`  --border-default: ${semantic.border.default};`);
	lines.push(`  --border-subtle: ${semantic.border.subtle};`);
	lines.push(`  --border-strong: ${semantic.border.strong};`);
	lines.push(`  --border-accent: ${semantic.border.accent};`);

	// Text
	lines.push('  /* Text */');
	lines.push(`  --text-primary: ${semantic.text.primary};`);
	lines.push(`  --text-secondary: ${semantic.text.secondary};`);
	lines.push(`  --text-muted: ${semantic.text.muted};`);
	lines.push(`  --text-inverse: ${semantic.text.inverse};`);
	lines.push(`  --text-accent: ${semantic.text.accent};`);

	// Accents
	lines.push('  /* Accents */');
	lines.push(`  --accent-primary: ${semantic.accent.primary};`);
	lines.push(`  --accent-secondary: ${semantic.accent.secondary};`);

	// Status
	lines.push('  /* Status */');
	lines.push(`  --status-success: ${semantic.status.success};`);
	lines.push(`  --status-warning: ${semantic.status.warning};`);
	lines.push(`  --status-error: ${semantic.status.error};`);
	lines.push(`  --status-info: ${semantic.status.info};`);

	// Agent colors
	lines.push('  /* Agent Colors */');
	Object.entries(semantic.agent).forEach(([role, color]) => {
		lines.push(`  --agent-${role}: ${color};`);
	});

	lines.push('}');

	return lines.join('\n');
}

// Export theme object
export const theme = {
	primitives,
	semantic,
	components
} as const;

export type Theme = typeof theme;
