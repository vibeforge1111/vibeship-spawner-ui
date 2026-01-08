/**
 * Migration script to convert H70 skill.yaml files to spawner-ui skills.json
 * Run with: node migrate-h70-skills.cjs
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

// Configuration
const H70_SKILL_LAB = 'C:\\Users\\USER\\Desktop\\vibeship-h70\\skill-lab';
const OUTPUT_PATH = path.join(__dirname, 'static', 'skills.json');
const BACKUP_PATH = path.join(__dirname, 'static', 'skills.json.backup');

// Category mapping based on folder names or tags
const CATEGORY_MAPPINGS = {
  // AI/ML
  'ai': ['ai-', 'ml-', 'llm', 'transformer', 'prompt', 'voice-ai', 'conversation-memory', 'on-device-ai', 'reinforcement'],
  // Blockchain
  'blockchain': ['defi', 'solana', 'blockchain', 'cross-chain', 'layer2', 'x402'],
  // Finance
  'finance': ['trading', 'portfolio', 'derivatives', 'risk-', 'pricing', 'algorithmic'],
  // Marketing
  'marketing': ['marketing', 'content-creation', 'sales', 'growth', 'launch', 'pitch', 'explainer', 'creative-comm', 'community', 'anti-marketing', 'roast-writing', 'cultural-remix', 'cliffhanger'],
  // Enterprise
  'enterprise': ['multi-tenancy', 'compliance', 'disaster', 'enterprise', 'data-governance', 'integration-patterns', 'salesforce', 'hr-'],
  // Database
  'database': ['drizzle', 'database', 'pg-boss', 'bullmq', 'postgres', 'graphile'],
  // DevOps
  'devops': ['vercel', 'cloudflare', 'deployment', 'incident', 'trigger-dev', 'inngest'],
  // Strategy
  'strategy': ['product-strategy', 'product-market', 'go-to-market', 'fundraising', 'decision', 'competitive', 'scope-creep', 'tech-debt'],
  // Frameworks
  'frameworks': ['nextjs', 'supabase', 'discord', 'slack', 'godot', 'bubble', 'websocket'],
  // Design
  'design': ['art-', 'motion', 'interactive-portfolio', 'digital-humans', 'synthetic-influencer', 'voiceover', 'hand-gesture'],
  // Development (default)
  'development': []
};

function detectCategory(skillId, yaml) {
  const checkString = skillId.toLowerCase();

  for (const [category, patterns] of Object.entries(CATEGORY_MAPPINGS)) {
    for (const pattern of patterns) {
      if (checkString.includes(pattern.toLowerCase())) {
        return category;
      }
    }
  }

  return 'development'; // Default category
}

function extractTriggers(yamlContent) {
  // Check for explicit triggers field
  if (yamlContent.triggers && Array.isArray(yamlContent.triggers)) {
    return yamlContent.triggers;
  }

  // Generate triggers from name and description
  const triggers = [];

  if (yamlContent.name) {
    triggers.push(yamlContent.name.toLowerCase().replace(/-/g, ' '));
  }

  // Add some keywords from owns if present
  if (yamlContent.owns && Array.isArray(yamlContent.owns)) {
    yamlContent.owns.slice(0, 3).forEach(own => {
      // Extract key phrase (first 3-4 words)
      const phrase = own.split(' ').slice(0, 4).join(' ').toLowerCase();
      if (phrase.length > 3 && phrase.length < 50) {
        triggers.push(phrase);
      }
    });
  }

  return triggers;
}

function extractHandoffs(yamlContent) {
  const handoffs = [];

  if (yamlContent.delegates && Array.isArray(yamlContent.delegates)) {
    yamlContent.delegates.forEach(delegate => {
      if (delegate.skill) {
        handoffs.push({
          to: delegate.skill,
          trigger: delegate.when || ''
        });
      }
    });
  }

  return handoffs;
}

function extractTags(yamlContent, skillId) {
  const tags = new Set();
  const stopWords = ['with', 'from', 'that', 'this', 'for', 'and', 'the', 'using', 'when', 'into', 'proper', 'based', 'deep'];

  // Add tags from owns
  if (yamlContent.owns && Array.isArray(yamlContent.owns)) {
    yamlContent.owns.forEach(own => {
      // Extract key terms - clean up first
      const cleaned = own.toLowerCase()
        .replace(/[()]/g, '')  // Remove parentheses
        .replace(/,\s*/g, ' ')  // Replace commas with spaces
        .replace(/[^a-z0-9\s-]/g, '');  // Keep only alphanumeric, spaces, hyphens

      const words = cleaned.split(/\s+/);
      words.forEach(word => {
        if (word.length > 3 && !stopWords.includes(word) && !/^\d+$/.test(word)) {
          tags.add(word);
        }
      });
    });
  }

  // Add explicit tags from yaml if present
  if (yamlContent.tags && Array.isArray(yamlContent.tags)) {
    yamlContent.tags.forEach(tag => {
      if (typeof tag === 'string') {
        const cleaned = tag.toLowerCase().replace(/[^a-z0-9-]/g, '');
        if (cleaned.length > 2) {
          tags.add(cleaned);
        }
      }
    });
  }

  // Limit to 10 most relevant tags
  return Array.from(tags).slice(0, 10);
}

function convertSkill(skillDir, yamlContent) {
  const skillId = path.basename(skillDir);

  return {
    id: skillId,
    name: yamlContent.name || skillId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    description: yamlContent.description || '',
    category: detectCategory(skillId, yamlContent),
    tier: 'free',
    layer: 1,
    tags: extractTags(yamlContent, skillId),
    triggers: extractTriggers(yamlContent),
    pairsWell: [],
    handoffs: extractHandoffs(yamlContent)
  };
}

function main() {
  console.log('Starting H70 Skills Migration...\n');

  // Backup existing skills.json
  if (fs.existsSync(OUTPUT_PATH)) {
    console.log(`Backing up existing skills.json to ${BACKUP_PATH}`);
    fs.copyFileSync(OUTPUT_PATH, BACKUP_PATH);
  }

  // Find all skill.yaml files
  const skillDirs = fs.readdirSync(H70_SKILL_LAB, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => path.join(H70_SKILL_LAB, dirent.name));

  console.log(`Found ${skillDirs.length} skill directories\n`);

  const skills = [];
  const errors = [];

  for (const skillDir of skillDirs) {
    const yamlPath = path.join(skillDir, 'skill.yaml');

    if (!fs.existsSync(yamlPath)) {
      console.log(`  Skipping ${path.basename(skillDir)} - no skill.yaml`);
      continue;
    }

    try {
      const yamlContent = yaml.parse(fs.readFileSync(yamlPath, 'utf8'));
      const skill = convertSkill(skillDir, yamlContent);
      skills.push(skill);
      console.log(`  Converted: ${skill.id} (${skill.category})`);
    } catch (err) {
      errors.push({ dir: skillDir, error: err.message });
      console.log(`  ERROR: ${path.basename(skillDir)} - ${err.message}`);
    }
  }

  // Sort skills by category then name
  skills.sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return a.name.localeCompare(b.name);
  });

  // Write new skills.json
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(skills, null, 2));

  console.log(`\n========================================`);
  console.log(`Migration Complete!`);
  console.log(`========================================`);
  console.log(`Total skills converted: ${skills.length}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Output: ${OUTPUT_PATH}`);
  console.log(`Backup: ${BACKUP_PATH}`);

  // Category breakdown
  const categoryCount = {};
  skills.forEach(s => {
    categoryCount[s.category] = (categoryCount[s.category] || 0) + 1;
  });

  console.log(`\nCategory breakdown:`);
  Object.entries(categoryCount).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });

  if (errors.length > 0) {
    console.log(`\nErrors:`);
    errors.forEach(({ dir, error }) => {
      console.log(`  ${path.basename(dir)}: ${error}`);
    });
  }
}

main();
