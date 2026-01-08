#!/usr/bin/env node
/**
 * Spawner H70 MCP Server
 *
 * Local MCP server that serves skills from the H70 skill-lab.
 * This is PRIVATE to spawner-ui and reads from local files.
 *
 * Tools:
 * - spawner_h70_skills: Get skill content from H70 skill-lab
 * - spawner_h70_list: List all available H70 skills
 * - spawner_h70_search: Search H70 skills by query
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';

// H70 skill-lab path
const H70_SKILL_LAB = process.env.H70_SKILL_LAB || 'C:/Users/USER/Desktop/vibeship-h70/skill-lab';

/**
 * Read and parse an H70 skill
 */
function readH70Skill(skillId) {
  const skillPath = path.join(H70_SKILL_LAB, skillId, 'skill.yaml');

  if (!fs.existsSync(skillPath)) {
    return null;
  }

  try {
    const rawYaml = fs.readFileSync(skillPath, 'utf-8');
    const skill = parseYaml(rawYaml);
    return { ...skill, id: skillId, rawYaml };
  } catch (e) {
    console.error(`Error reading skill ${skillId}:`, e.message);
    return null;
  }
}

/**
 * Format H70 skill into comprehensive instructions
 */
function formatSkillContent(skill) {
  const lines = [];

  lines.push(`# ${skill.name || skill.id}`);
  lines.push('');
  lines.push(`> ${skill.description || 'No description'}`);
  lines.push('');
  lines.push(`**Skill ID:** ${skill.id}`);
  lines.push(`**Source:** H70 Skill Lab (Local)`);
  lines.push('');

  if (skill.identity) {
    lines.push('## Identity');
    lines.push('');
    lines.push(skill.identity.trim());
    lines.push('');
  }

  if (skill.owns && skill.owns.length > 0) {
    lines.push('## Expertise Areas');
    lines.push('');
    skill.owns.forEach(own => lines.push(`- ${own}`));
    lines.push('');
  }

  if (skill.delegates && skill.delegates.length > 0) {
    lines.push('## When to Delegate');
    lines.push('');
    skill.delegates.forEach(d => {
      lines.push(`- **${d.skill}**: ${d.when}`);
    });
    lines.push('');
  }

  if (skill.disasters && skill.disasters.length > 0) {
    lines.push('## Critical Lessons');
    lines.push('');
    skill.disasters.forEach((d, i) => {
      lines.push(`### ${i + 1}. ${d.title}`);
      lines.push(`**Story:** ${d.story}`);
      lines.push(`**Lesson:** ${d.lesson}`);
      lines.push('');
    });
  }

  if (skill.anti_patterns && skill.anti_patterns.length > 0) {
    lines.push('## Anti-Patterns');
    lines.push('');
    skill.anti_patterns.forEach(ap => {
      lines.push(`### ${ap.name}`);
      lines.push(`**Why bad:** ${ap.why_bad}`);
      lines.push(`**Instead:** ${ap.instead}`);
      if (ap.code_smell) lines.push(`**Code smell:** \`${ap.code_smell}\``);
      lines.push('');
    });
  }

  if (skill.patterns && skill.patterns.length > 0) {
    lines.push('## Patterns');
    lines.push('');
    skill.patterns.forEach(p => {
      lines.push(`### ${p.name}`);
      lines.push(`**When:** ${p.when}`);
      lines.push('');
      lines.push(p.implementation);
      lines.push('');
    });
  }

  if (skill.triggers && skill.triggers.length > 0) {
    lines.push('---');
    lines.push(`**Triggers:** ${skill.triggers.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * List all H70 skills
 */
function listH70Skills() {
  const skills = [];

  try {
    const dirs = fs.readdirSync(H70_SKILL_LAB, { withFileTypes: true });

    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;

      const skillPath = path.join(H70_SKILL_LAB, dir.name, 'skill.yaml');
      if (!fs.existsSync(skillPath)) continue;

      try {
        const rawYaml = fs.readFileSync(skillPath, 'utf-8');
        const skill = parseYaml(rawYaml);
        skills.push({
          id: dir.name,
          name: skill.name || dir.name,
          description: skill.description || '',
          triggers: skill.triggers || [],
          tags: skill.tags || []
        });
      } catch (e) {
        // Skip invalid YAML files
      }
    }
  } catch (e) {
    console.error('Error listing skills:', e.message);
  }

  return skills;
}

/**
 * Search H70 skills
 */
function searchH70Skills(query) {
  const allSkills = listH70Skills();
  const queryLower = query.toLowerCase();

  return allSkills.filter(skill => {
    return (
      skill.id.toLowerCase().includes(queryLower) ||
      skill.name.toLowerCase().includes(queryLower) ||
      skill.description.toLowerCase().includes(queryLower) ||
      skill.triggers.some(t => t.toLowerCase().includes(queryLower)) ||
      skill.tags.some(t => t.toLowerCase().includes(queryLower))
    );
  });
}

// Create MCP server
const server = new Server(
  {
    name: 'spawner-h70',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'spawner_h70_skills',
        description: 'Get H70 skill content by ID. Returns full skill with identity, patterns, anti-patterns, disasters.',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['get', 'list', 'search'],
              description: 'Action: get (single skill), list (all skills), search (by query)'
            },
            name: {
              type: 'string',
              description: 'Skill ID for get action (e.g., "drizzle-orm", "nextjs-app-router")'
            },
            query: {
              type: 'string',
              description: 'Search query for search action'
            }
          },
          required: ['action']
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'spawner_h70_skills') {
    const action = args?.action || 'get';

    if (action === 'get') {
      const skillId = args?.name;
      if (!skillId) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Skill ID required' }) }]
        };
      }

      const skill = readH70Skill(skillId);
      if (!skill) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: `Skill not found: ${skillId}` }) }]
        };
      }

      const formattedContent = formatSkillContent(skill);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            skill_content: formattedContent,
            skill_id: skill.id,
            skill_name: skill.name,
            source: 'h70-local',
            local_path: path.join(H70_SKILL_LAB, skillId),
            _instruction: `Loaded H70 skill: **${skill.name}**\nSource: Local H70 Skill Lab`
          })
        }]
      };
    }

    if (action === 'list') {
      const skills = listH70Skills();
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            skills: skills,
            count: skills.length,
            source: 'h70-local'
          })
        }]
      };
    }

    if (action === 'search') {
      const query = args?.query || '';
      const results = searchH70Skills(query);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            skills: results,
            count: results.length,
            query: query,
            source: 'h70-local'
          })
        }]
      };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify({ error: `Unknown action: ${action}` }) }]
    };
  }

  return {
    content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${name}` }) }]
  };
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Spawner H70 MCP server running');
  console.error(`Skill lab: ${H70_SKILL_LAB}`);
}

main().catch(console.error);
