/**
 * Generate triggers for H70 skills that lack them
 *
 * This script:
 * 1. Reads all skill.yaml files in vibeship-h70/skill-lab
 * 2. Checks if they have triggers field
 * 3. If not, generates triggers from name, description, and owns
 * 4. Writes the updated YAML back
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

const H70_PATH = 'C:/Users/USER/Desktop/vibeship-h70/skill-lab';

/**
 * Extract trigger phrases from skill name
 * e.g., "game-development" → ["game development", "game dev", "game"]
 */
function extractFromName(name) {
  const triggers = [];

  // Full name with spaces
  const spacedName = name.replace(/-/g, ' ');
  triggers.push(spacedName);

  // Individual words (if multi-word)
  const words = name.split('-');
  if (words.length > 1) {
    // Add key individual words (skip common ones)
    const skipWords = ['the', 'a', 'an', 'for', 'with', 'and', 'or', 'to', 'in', 'of'];
    for (const word of words) {
      if (word.length > 2 && !skipWords.includes(word)) {
        triggers.push(word);
      }
    }
  }

  return triggers;
}

/**
 * Extract trigger phrases from description
 * e.g., "Building interactive experiences..." → ["interactive experiences", "building"]
 */
function extractFromDescription(description) {
  if (!description) return [];

  const triggers = [];

  // Get first sentence (usually most informative)
  const firstSentence = description.split(/[.!?]/)[0].toLowerCase().trim();

  // Extract 2-3 word phrases using common patterns
  const phrasePatterns = [
    /(?:building|creating|implementing|managing|handling)\s+(\w+(?:\s+\w+)?)/gi,
    /(\w+\s+(?:system|architecture|management|integration|optimization|development))/gi,
    /(\w+\s+(?:patterns?|strategies|solutions))/gi,
  ];

  for (const pattern of phrasePatterns) {
    const matches = firstSentence.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[1].length > 3) {
        triggers.push(match[1].toLowerCase());
      }
    }
  }

  // Extract key noun phrases (2-3 words)
  const words = firstSentence.split(/\s+/);
  for (let i = 0; i < words.length - 1; i++) {
    const twoWord = `${words[i]} ${words[i + 1]}`.replace(/[^a-z\s]/g, '');
    if (twoWord.length > 5 && !twoWord.includes('  ')) {
      triggers.push(twoWord);
    }
  }

  return triggers;
}

/**
 * Extract trigger phrases from owns array
 * e.g., ["Game architecture and loop structure"] → ["game architecture", "loop structure"]
 */
function extractFromOwns(owns) {
  if (!owns || !Array.isArray(owns)) return [];

  const triggers = [];

  for (const own of owns) {
    const lower = own.toLowerCase();

    // Remove quotes if present
    const cleaned = lower.replace(/['"]/g, '');

    // Split on "and", "or", commas
    const parts = cleaned.split(/(?:\s+and\s+|\s+or\s+|,\s*)/);

    for (const part of parts) {
      const trimmed = part.trim();

      // Skip very short phrases
      if (trimmed.length < 4) continue;

      // Add the phrase
      triggers.push(trimmed);

      // Extract 2-word subphrases if longer
      const words = trimmed.split(/\s+/);
      if (words.length > 2) {
        for (let i = 0; i < words.length - 1; i++) {
          const twoWord = `${words[i]} ${words[i + 1]}`;
          if (twoWord.length > 5) {
            triggers.push(twoWord);
          }
        }
      }
    }
  }

  return triggers;
}

/**
 * Deduplicate and clean triggers
 */
function cleanTriggers(triggers) {
  const seen = new Set();
  const cleaned = [];

  // Skip common/generic words
  const skipPhrases = [
    'the', 'and', 'for', 'with', 'that', 'this', 'from', 'your',
    'best practices', 'implementation', 'development', 'management',
    'building', 'creating', 'using', 'working with'
  ];

  for (let trigger of triggers) {
    // Normalize
    trigger = trigger.toLowerCase().trim();

    // Skip if too short or too long
    if (trigger.length < 3 || trigger.length > 50) continue;

    // Skip common phrases
    if (skipPhrases.some(skip => trigger === skip)) continue;

    // Skip if already seen
    if (seen.has(trigger)) continue;

    seen.add(trigger);
    cleaned.push(trigger);
  }

  // Sort by length (shorter = more specific usually)
  cleaned.sort((a, b) => a.length - b.length);

  // Limit to 15 triggers max
  return cleaned.slice(0, 15);
}

/**
 * Generate triggers for a skill
 */
function generateTriggers(skill) {
  const triggers = [];

  // From name
  if (skill.name) {
    triggers.push(...extractFromName(skill.name));
  }

  // From description
  if (skill.description) {
    triggers.push(...extractFromDescription(skill.description));
  }

  // From owns (most valuable)
  if (skill.owns) {
    triggers.push(...extractFromOwns(skill.owns));
  }

  return cleanTriggers(triggers);
}

/**
 * Insert triggers into YAML content after description
 */
function insertTriggersIntoYaml(content, triggers) {
  // Format triggers as YAML array
  const triggersYaml = 'triggers:\n' + triggers.map(t => `  - "${t}"`).join('\n');

  // Find where to insert (after description, before identity/owns/version)
  const lines = content.split('\n');
  let insertIndex = -1;
  let inDescription = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track if we're in description block
    if (line.match(/^description:/)) {
      inDescription = true;
      continue;
    }

    // If we're past description and hit a new top-level key
    if (inDescription && line.match(/^[a-z_]+:/)) {
      insertIndex = i;
      break;
    }
  }

  if (insertIndex === -1) {
    // Fallback: insert after first few lines
    insertIndex = 5;
  }

  // Insert triggers
  lines.splice(insertIndex, 0, '', triggersYaml);

  return lines.join('\n');
}

/**
 * Process a single skill directory
 */
function processSkill(skillDir) {
  const skillPath = path.join(skillDir, 'skill.yaml');

  if (!fs.existsSync(skillPath)) {
    return { skipped: true, reason: 'no skill.yaml' };
  }

  const content = fs.readFileSync(skillPath, 'utf-8');

  // Check if already has triggers
  if (content.includes('triggers:')) {
    return { skipped: true, reason: 'already has triggers' };
  }

  // Parse YAML
  let skill;
  try {
    skill = yaml.parse(content);
  } catch (e) {
    return { skipped: true, reason: 'YAML parse error: ' + e.message };
  }

  // Generate triggers
  const triggers = generateTriggers(skill);

  if (triggers.length === 0) {
    return { skipped: true, reason: 'no triggers generated' };
  }

  // Insert triggers into YAML
  const updatedContent = insertTriggersIntoYaml(content, triggers);

  // Write back
  fs.writeFileSync(skillPath, updatedContent);

  return {
    updated: true,
    triggers: triggers.length,
    sample: triggers.slice(0, 5)
  };
}

/**
 * Main function
 */
function main() {
  console.log('=== H70 Trigger Generator ===\n');
  console.log(`Reading skills from: ${H70_PATH}\n`);

  const skills = fs.readdirSync(H70_PATH, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  console.log(`Found ${skills.length} skill directories\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const results = {
    updated: [],
    skipped: [],
    errors: []
  };

  for (const skill of skills) {
    const skillDir = path.join(H70_PATH, skill);

    try {
      const result = processSkill(skillDir);

      if (result.updated) {
        updated++;
        results.updated.push({ name: skill, ...result });
        console.log(`✓ ${skill}: Added ${result.triggers} triggers (${result.sample.join(', ')}...)`);
      } else if (result.skipped) {
        skipped++;
        results.skipped.push({ name: skill, reason: result.reason });
      }
    } catch (e) {
      errors++;
      results.errors.push({ name: skill, error: e.message });
      console.error(`✗ ${skill}: ${e.message}`);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped} (${results.skipped.filter(s => s.reason === 'already has triggers').length} already had triggers)`);
  console.log(`Errors: ${errors}`);

  // Write detailed results
  fs.writeFileSync(
    path.join(__dirname, 'trigger-generation-results.json'),
    JSON.stringify(results, null, 2)
  );
  console.log('\nDetailed results written to trigger-generation-results.json');
}

main();
