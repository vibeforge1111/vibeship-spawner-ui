/**
 * Build a skill catalog with context for Claude
 *
 * Creates a JSON file with:
 * - id: skill identifier
 * - description: short description
 * - owns: expertise areas (what this skill is good at)
 *
 * This gives Claude enough context to intelligently select skills
 * without sending full skill content.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

const H70_PATH =
  process.env.SPAWNER_H70_SKILLS_DIR ||
  process.env.H70_SKILLS_LAB_DIR ||
  'C:/Users/USER/Desktop/spark-skill-graphs';
const OUTPUT_PATH = path.join(__dirname, '../src/lib/data/skill-catalog.json');

function ownText(own) {
  if (typeof own === 'string') return own.trim();
  if (!own || typeof own !== 'object') return '';

  return String(
    own.title ||
    own.name ||
    own.area ||
    own.capability ||
    own.decision_authority ||
    own.scope ||
    ''
  ).trim();
}

function ownTexts(owns) {
  return Array.isArray(owns) ? owns.map(ownText).filter(Boolean) : [];
}

/**
 * Extract relevant context from a skill
 */
function extractSkillContext(skillPath, skillName, category) {
  const content = fs.readFileSync(skillPath, 'utf-8');

  let skill;
  try {
    skill = yaml.parse(content);
  } catch (e) {
    console.error(`Failed to parse ${skillName}: ${e.message}`);
    return null;
  }

  // Extract owns as a simple array
  const owns = ownTexts(skill.owns).map(own => own.replace(/['"]/g, '').trim());

  // Get description (first sentence or full if short)
  let description = skill.description || '';
  if (typeof description === 'string') {
    description = description.trim();
    // Take first sentence if too long
    if (description.length > 200) {
      const firstSentence = description.split(/[.!?]/)[0];
      description = firstSentence.length > 20 ? firstSentence : description.slice(0, 200);
    }
  }

  return {
    id: skillName,
    name: skill.name || skillName,
    description: description,
    owns: owns.slice(0, 10), // Limit to top 10 expertise areas
    triggers: Array.isArray(skill.triggers) ? skill.triggers : [],
    category: skill.category || category || 'general',
    pairsWell: Array.isArray(skill.pairs_with) ? skill.pairs_with : [],
    selectionHints: skill.selection_hints || {}
  };
}

/**
 * Group skills by category for easier Claude reasoning
 */
function groupByCategory(skills) {
  const groups = {};

  for (const skill of skills) {
    const category = skill.category || 'general';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(skill);
  }

  return groups;
}

/**
 * Main function
 */
function main() {
  console.log('=== Building Skill Catalog for Claude ===\n');
  console.log(`Reading skills from: ${H70_PATH}\n`);

  const NON_SKILL_DIRS = new Set(['mcp-server', 'tools', 'viz', 'benchmark', 'benchmarks', 'h70-to-clawdbot', '.github', 'config', 'bundles', 'release-artifacts', 'eval']);
  const categories = fs.readdirSync(H70_PATH, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.') && !NON_SKILL_DIRS.has(d.name))
    .map(d => d.name);

  const skillFiles = [];
  for (const category of categories) {
    const categoryDir = path.join(H70_PATH, category);
    const files = fs.readdirSync(categoryDir, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith('.yaml'))
      .map(entry => ({
        category,
        skillName: path.basename(entry.name, '.yaml'),
        skillPath: path.join(categoryDir, entry.name)
      }));

    skillFiles.push(...files);
  }

  console.log(`Found ${skillFiles.length} skill files\n`);

  const catalog = [];
  let success = 0;
  let failed = 0;

  for (const { skillName, skillPath, category } of skillFiles) {
    const context = extractSkillContext(skillPath, skillName, category);

    if (context) {
      catalog.push(context);
      success++;
    } else {
      failed++;
    }
  }

  const validIds = new Set(catalog.map(skill => skill.id));
  for (const skill of catalog) {
    skill.pairsWell = skill.pairsWell.filter(skillId => validIds.has(skillId));
  }

  console.log(`\nProcessed: ${success} skills`);
  console.log(`Failed: ${failed} skills`);

  // Group by category
  const grouped = groupByCategory(catalog);
  console.log('\nCategories found:');
  for (const [category, skills] of Object.entries(grouped)) {
    console.log(`  ${category}: ${skills.length} skills`);
  }

  // Build output
  const output = {
    version: '1.0.0',
    generatedAt: 'deterministic',
    totalSkills: catalog.length,
    categories: Object.keys(grouped),
    skills: catalog,
    grouped: grouped
  };

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write catalog
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\nCatalog written to: ${OUTPUT_PATH}`);

  // Also create a compact version for Claude (just id + short description + owns)
  const compactCatalog = catalog.map(skill => ({
    id: skill.id,
    desc: skill.description.slice(0, 100),
    owns: skill.owns.slice(0, 5),
    triggers: skill.triggers.slice(0, 5),
    pairsWell: skill.pairsWell.slice(0, 5),
    selectionHints: skill.selectionHints
  }));

  const compactPath = OUTPUT_PATH.replace('.json', '-compact.json');
  fs.writeFileSync(compactPath, JSON.stringify(compactCatalog, null, 2));
  console.log(`Compact catalog written to: ${compactPath}`);

  // Calculate approximate token count for Claude
  const compactJson = JSON.stringify(compactCatalog);
  const estimatedTokens = Math.ceil(compactJson.length / 4);
  console.log(`\nCompact catalog size: ${compactJson.length} chars (~${estimatedTokens} tokens)`);
}

main();
