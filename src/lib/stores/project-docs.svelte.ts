/**
 * Project Documents Store
 *
 * Manages PRD, Architecture, and Implementation Plan documents.
 * These documents drive workflow generation on the canvas.
 */

import { browser } from '$app/environment';

const STORAGE_KEY = 'spawner-project-docs';

export interface ProjectDocs {
	prd: string;
	architecture: string;
	implementation: string;
	projectName: string;
	lastUpdated: string;
}

export interface ParsedTask {
	id: string;
	title: string;
	description: string;
	skillId?: string;
	dependsOn: string[];
	category: string;
}

const DEFAULT_PRD = `# Product Requirements Document

## Overview
Describe what you're building and why.

## Target Users
Who is this for?

## Core Features
1. **Feature 1**: Description
2. **Feature 2**: Description
3. **Feature 3**: Description

## Success Metrics
- Metric 1
- Metric 2

## Constraints
- Technical constraints
- Time constraints
- Resource constraints
`;

const DEFAULT_ARCHITECTURE = `# Architecture Document

## System Overview
High-level description of the system architecture.

## Tech Stack
- **Frontend**:
- **Backend**:
- **Database**:
- **Infrastructure**:

## Components
\`\`\`
┌─────────────┐     ┌─────────────┐
│  Frontend   │────►│   Backend   │
└─────────────┘     └─────────────┘
                           │
                    ┌──────▼──────┐
                    │  Database   │
                    └─────────────┘
\`\`\`

## Data Flow
1. User action → Frontend
2. Frontend → API call
3. Backend → Database
4. Response → Frontend

## Security Considerations
- Authentication method
- Data encryption
- Access control
`;

const DEFAULT_IMPLEMENTATION = `# Implementation Plan

## Phase 1: Foundation
<!-- Each task becomes a node on the canvas -->

### Task: Project Setup
- **Skill**: project-scaffolding
- **Description**: Initialize project structure, install dependencies
- **Depends on**: none

### Task: Design System
- **Skill**: design-system
- **Description**: Create color palette, typography, component tokens
- **Depends on**: Project Setup

## Phase 2: Core Features

### Task: Frontend Components
- **Skill**: frontend-development
- **Description**: Build UI components based on design system
- **Depends on**: Design System

### Task: Backend API
- **Skill**: backend-development
- **Description**: Implement REST/GraphQL API endpoints
- **Depends on**: Project Setup

### Task: Database Schema
- **Skill**: database-design
- **Description**: Design and implement database schema
- **Depends on**: Backend API

## Phase 3: Integration

### Task: API Integration
- **Skill**: api-integration
- **Description**: Connect frontend to backend APIs
- **Depends on**: Frontend Components, Backend API

### Task: Testing
- **Skill**: testing
- **Description**: Write unit and integration tests
- **Depends on**: API Integration

## Phase 4: Deployment

### Task: CI/CD Pipeline
- **Skill**: ci-cd-pipeline
- **Description**: Set up automated build and deploy
- **Depends on**: Testing

### Task: Production Deploy
- **Skill**: deployment
- **Description**: Deploy to production environment
- **Depends on**: CI/CD Pipeline
`;

// Load from localStorage
function loadFromStorage(): ProjectDocs {
	if (browser) {
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				return JSON.parse(saved);
			}
		} catch (e) {
			console.error('Failed to load project docs:', e);
		}
	}
	return {
		prd: DEFAULT_PRD,
		architecture: DEFAULT_ARCHITECTURE,
		implementation: DEFAULT_IMPLEMENTATION,
		projectName: 'New Project',
		lastUpdated: new Date().toISOString()
	};
}

// State
let docs = $state<ProjectDocs>(loadFromStorage());

/**
 * Save to localStorage
 */
function saveToStorage(): void {
	if (browser) {
		try {
			docs.lastUpdated = new Date().toISOString();
			localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
		} catch (e) {
			console.error('Failed to save project docs:', e);
		}
	}
}

/**
 * Get current docs (reactive)
 */
export function getProjectDocs(): ProjectDocs {
	return docs;
}

/**
 * Update PRD
 */
export function setPRD(content: string): void {
	docs.prd = content;
	saveToStorage();
}

/**
 * Update Architecture
 */
export function setArchitecture(content: string): void {
	docs.architecture = content;
	saveToStorage();
}

/**
 * Update Implementation Plan
 */
export function setImplementation(content: string): void {
	docs.implementation = content;
	saveToStorage();
}

/**
 * Update Project Name
 */
export function setProjectName(name: string): void {
	docs.projectName = name;
	saveToStorage();
}

/**
 * Reset to defaults
 */
export function resetToDefaults(): void {
	docs.prd = DEFAULT_PRD;
	docs.architecture = DEFAULT_ARCHITECTURE;
	docs.implementation = DEFAULT_IMPLEMENTATION;
	docs.projectName = 'New Project';
	saveToStorage();
}

/**
 * Parse Implementation Plan into tasks
 * Extracts tasks from markdown format
 */
export function parseImplementationPlan(markdown: string): ParsedTask[] {
	const tasks: ParsedTask[] = [];
	const lines = markdown.split('\n');

	let currentTask: Partial<ParsedTask> | null = null;
	let currentPhase = '';
	let taskIndex = 0;

	for (const line of lines) {
		// Detect phase headers
		if (line.startsWith('## Phase')) {
			currentPhase = line.replace('## ', '').trim();
			continue;
		}

		// Detect task headers
		if (line.startsWith('### Task:')) {
			// Save previous task if exists
			if (currentTask && currentTask.title) {
				tasks.push({
					id: `task-${taskIndex}`,
					title: currentTask.title || '',
					description: currentTask.description || '',
					skillId: currentTask.skillId,
					dependsOn: currentTask.dependsOn || [],
					category: currentPhase
				});
				taskIndex++;
			}

			// Start new task
			currentTask = {
				title: line.replace('### Task:', '').trim(),
				dependsOn: []
			};
			continue;
		}

		// Parse task properties
		if (currentTask) {
			if (line.startsWith('- **Skill**:')) {
				currentTask.skillId = line.replace('- **Skill**:', '').trim();
			} else if (line.startsWith('- **Description**:')) {
				currentTask.description = line.replace('- **Description**:', '').trim();
			} else if (line.startsWith('- **Depends on**:')) {
				const deps = line.replace('- **Depends on**:', '').trim();
				if (deps.toLowerCase() !== 'none') {
					currentTask.dependsOn = deps.split(',').map(d => d.trim());
				}
			}
		}
	}

	// Don't forget the last task
	if (currentTask && currentTask.title) {
		tasks.push({
			id: `task-${taskIndex}`,
			title: currentTask.title || '',
			description: currentTask.description || '',
			skillId: currentTask.skillId,
			dependsOn: currentTask.dependsOn || [],
			category: currentPhase
		});
	}

	return tasks;
}

/**
 * Export all docs as a single markdown file
 */
export function exportAsMarkdown(): string {
	return `# ${docs.projectName}

---

${docs.prd}

---

${docs.architecture}

---

${docs.implementation}
`;
}

/**
 * Import from combined markdown (splits by ---)
 */
export function importFromMarkdown(markdown: string): boolean {
	try {
		const sections = markdown.split('\n---\n');
		if (sections.length >= 4) {
			// Extract project name from first section
			const firstLine = sections[0].trim();
			if (firstLine.startsWith('# ')) {
				docs.projectName = firstLine.replace('# ', '').trim();
			}
			docs.prd = sections[1].trim();
			docs.architecture = sections[2].trim();
			docs.implementation = sections[3].trim();
			saveToStorage();
			return true;
		}
		return false;
	} catch (e) {
		console.error('Failed to import markdown:', e);
		return false;
	}
}

// Export defaults for templates
export { DEFAULT_PRD, DEFAULT_ARCHITECTURE, DEFAULT_IMPLEMENTATION };
