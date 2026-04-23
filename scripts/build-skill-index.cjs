/**
 * Build a minimal skill index for intelligent Claude selection
 *
 * Creates TWO files:
 * 1. skill-index.json - Minimal format for Claude (id: keywords)
 * 2. skill-details.json - Full details for after selection
 *
 * Stage 1: Claude sees minimal index (~5k tokens) to pick skills
 * Stage 2: System loads full details for selected skills only
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

const H70_PATH =
  process.env.SPAWNER_H70_SKILLS_DIR ||
  process.env.H70_SKILLS_LAB_DIR ||
  'C:/Users/USER/Desktop/spark-skill-graphs';
const OUTPUT_DIR = path.join(__dirname, '../src/lib/data');

/**
 * Extract keywords from a skill for the minimal index
 */
function extractKeywords(skill, skillName) {
  const keywords = new Set();

  // From name
  skillName.split('-').forEach(word => {
    if (word.length > 2) keywords.add(word);
  });

  // From description (key nouns)
  if (skill.description) {
    const desc = skill.description.toLowerCase();
    // Extract important words
    const importantWords = desc.match(/\b(?:api|auth|database|frontend|backend|game|ai|ml|llm|agent|stripe|payment|user|admin|dashboard|component|react|next|svelte|node|python|typescript|graphql|rest|websocket|realtime|3d|mobile|web|deploy|test|security|oauth|jwt|cache|redis|postgres|supabase|firebase|aws|gcp|azure|docker|kubernetes|ci|cd|analytics|seo|email|notification|search|upload|file|image|video|audio|chat|message|workflow|automation|scraping|browser|extension|cli|sdk|plugin)\b/g);
    if (importantWords) {
      importantWords.forEach(w => keywords.add(w));
    }
  }

  // From owns (extract key terms)
  if (skill.owns && Array.isArray(skill.owns)) {
    skill.owns.forEach(own => {
      const lower = own.toLowerCase();
      // Extract 1-2 word key terms
      const terms = lower.match(/\b[a-z]{3,}\b/g);
      if (terms) {
        terms.slice(0, 3).forEach(t => keywords.add(t));
      }
    });
  }

  return Array.from(keywords).slice(0, 8); // Max 8 keywords per skill
}

/**
 * Process a single skill
 */
function processSkill(skillPath, skillName, category) {
  const content = fs.readFileSync(skillPath, 'utf-8');

  let skill;
  try {
    skill = yaml.parse(content);
  } catch (e) {
    return null;
  }

  // Minimal index entry
  const minimal = {
    id: skillName,
    kw: extractKeywords(skill, skillName)
  };

  // Full details entry
  const full = {
    id: skillName,
    name: skill.name || skillName,
    description: skill.description || '',
    owns: skill.owns || [],
    triggers: skill.triggers || [],
    category: remapCategory(skill.category || category || 'general', skillName),
    delegates: skill.delegates || []
  };

  return { minimal, full };
}

// Keep in sync with scripts/build-skill-catalog.cjs SPARKNET_COUNCIL_REMAP.
const SPARKNET_COUNCIL_REMAP = {
  'animation-motion': 'creative', 'api-design-fundamentals': 'backend',
  'architecture-spaces': 'architecture', 'astrophysics-fundamentals': 'space',
  'biology-fundamentals': 'biotech', 'blockchain-web3': 'blockchain',
  'chemistry-fundamentals': 'biotech', 'cognitive-behavioral': 'methodology',
  'communication-fundamentals': 'communications', 'conflict-resolution': 'communications',
  'craft-making': 'creative', 'cross-cultural-wisdom': 'community',
  'cybersecurity-fundamentals': 'security', 'data-engineering-fundamentals': 'data',
  'devops-automation': 'devops', 'earth-climate-science': 'climate',
  'entrepreneurship-fundamentals': 'startup', 'evolutionary-biology': 'biotech',
  'existential-philosophy': 'methodology', 'focus-techniques': 'methodology',
  'frontend-development': 'frontend', 'futures-thinking': 'strategy',
  'game-design-fundamentals': 'game-dev', 'growth-marketing': 'marketing',
  'health-fundamentals': 'biotech', 'investment-basics': 'finance',
  'leadership-fundamentals': 'business', 'logical-reasoning': 'methodology',
  'machine-learning-fundamentals': 'ai', 'mathematics-fundamentals': 'engineering',
  'mental-health': 'biotech', 'meta-learning': 'methodology',
  'mobile-development': 'frontend', 'music-audio': 'creative',
  'neuroscience-fundamentals': 'biotech', 'operations-systems': 'devops',
  'parenting-education': 'education', 'personal-finance-fundamentals': 'finance',
  'philosophy-fundamentals': 'methodology', 'physics-fundamentals': 'engineering',
  'productivity-systems': 'methodology', 'psychology-fundamentals': 'community',
  'quantum-mechanics': 'engineering', 'relationship-fundamentals': 'community',
  'sales-fundamentals': 'marketing', 'sociology-fundamentals': 'community',
  'software-architecture': 'architecture', 'storytelling-writing': 'creative',
  'team-dynamics-fundamentals': 'business', 'tech-ethics': 'methodology',
  'typography-fundamentals': 'design', 'visual-design': 'design'
};

function remapCategory(category, skillName) {
  if (category === 'sparknet-council' && SPARKNET_COUNCIL_REMAP[skillName]) {
    return SPARKNET_COUNCIL_REMAP[skillName];
  }
  return category;
}

/**
 * Create categorized minimal index for better Claude understanding
 */
function createCategorizedIndex(skills) {
  // Group by detected domain
  const domains = {
    game: [],
    ai: [],
    frontend: [],
    backend: [],
    devops: [],
    payments: [],
    auth: [],
    database: [],
    mobile: [],
    web3: [],
    content: [],
    analytics: [],
    testing: [],
    other: []
  };

  for (const skill of skills) {
    const id = skill.id.toLowerCase();
    const kw = skill.kw.join(' ');

    if (id.includes('game') || kw.includes('game') || kw.includes('player') || kw.includes('physics')) {
      domains.game.push(skill);
    } else if (id.includes('ai') || id.includes('llm') || id.includes('agent') || kw.includes('llm') || kw.includes('agent')) {
      domains.ai.push(skill);
    } else if (id.includes('frontend') || id.includes('react') || id.includes('svelte') || id.includes('ui') || id.includes('design')) {
      domains.frontend.push(skill);
    } else if (id.includes('backend') || id.includes('api') || id.includes('server') || id.includes('graphql')) {
      domains.backend.push(skill);
    } else if (id.includes('devops') || id.includes('deploy') || id.includes('ci') || id.includes('docker') || id.includes('kubernetes')) {
      domains.devops.push(skill);
    } else if (id.includes('stripe') || id.includes('payment') || id.includes('billing')) {
      domains.payments.push(skill);
    } else if (id.includes('auth') || id.includes('oauth') || id.includes('jwt') || id.includes('clerk')) {
      domains.auth.push(skill);
    } else if (id.includes('database') || id.includes('postgres') || id.includes('supabase') || id.includes('redis') || id.includes('sql')) {
      domains.database.push(skill);
    } else if (id.includes('mobile') || id.includes('react-native') || id.includes('flutter') || id.includes('ios') || id.includes('android')) {
      domains.mobile.push(skill);
    } else if (id.includes('web3') || id.includes('blockchain') || id.includes('solidity') || id.includes('nft') || id.includes('defi')) {
      domains.web3.push(skill);
    } else if (id.includes('content') || id.includes('cms') || id.includes('blog') || id.includes('seo')) {
      domains.content.push(skill);
    } else if (id.includes('analytics') || id.includes('metrics') || id.includes('tracking')) {
      domains.analytics.push(skill);
    } else if (id.includes('test') || id.includes('qa') || id.includes('e2e')) {
      domains.testing.push(skill);
    } else {
      domains.other.push(skill);
    }
  }

  return domains;
}

/**
 * Main function
 */
function main() {
  console.log('=== Building Skill Index ===\n');

  const NON_SKILL_DIRS = new Set(['mcp-server', 'tools', 'viz', 'benchmark', 'benchmarks', 'h70-to-clawdbot', '.github', 'config', 'bundles', 'release-artifacts', 'eval', 'methodology']);
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

  console.log(`Processing ${skillFiles.length} skills...\n`);

  const minimalIndex = [];
  const fullDetails = {};

  for (const { skillName, skillPath, category } of skillFiles) {
    const result = processSkill(skillPath, skillName, category);

    if (result) {
      minimalIndex.push(result.minimal);
      fullDetails[skillName] = result.full;
    }
  }

  // Create categorized index
  const categorized = createCategorizedIndex(minimalIndex);

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Write minimal index (for Claude)
  const minimalOutput = {
    version: '2.0.0',
    totalSkills: minimalIndex.length,
    domains: categorized,
    flat: minimalIndex
  };

  const minimalPath = path.join(OUTPUT_DIR, 'skill-index.json');
  fs.writeFileSync(minimalPath, JSON.stringify(minimalOutput, null, 2));

  // Write full details (for after selection)
  const fullPath = path.join(OUTPUT_DIR, 'skill-details.json');
  fs.writeFileSync(fullPath, JSON.stringify(fullDetails, null, 2));

  // Calculate sizes
  const minimalJson = JSON.stringify(minimalOutput);
  const fullJson = JSON.stringify(fullDetails);

  console.log(`\nMinimal index: ${minimalJson.length} chars (~${Math.ceil(minimalJson.length / 4)} tokens)`);
  console.log(`Full details: ${fullJson.length} chars`);

  // Print domain distribution
  console.log('\nDomain distribution:');
  for (const [domain, skills] of Object.entries(categorized)) {
    if (skills.length > 0) {
      console.log(`  ${domain}: ${skills.length} skills`);
    }
  }

  // Create an even more compact format - just for Claude prompt
  const ultraCompact = {};
  for (const [domain, skills] of Object.entries(categorized)) {
    if (skills.length > 0) {
      ultraCompact[domain] = skills.map(s => s.id).join(', ');
    }
  }

  const ultraCompactPath = path.join(OUTPUT_DIR, 'skill-index-ultra.json');
  fs.writeFileSync(ultraCompactPath, JSON.stringify(ultraCompact, null, 2));

  const ultraJson = JSON.stringify(ultraCompact);
  console.log(`\nUltra-compact: ${ultraJson.length} chars (~${Math.ceil(ultraJson.length / 4)} tokens)`);

  console.log('\nFiles written:');
  console.log(`  ${minimalPath}`);
  console.log(`  ${fullPath}`);
  console.log(`  ${ultraCompactPath}`);
}

main();
