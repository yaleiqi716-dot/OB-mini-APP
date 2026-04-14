import { readFile } from 'fs/promises';
import { join } from 'path';
import type { SkillRole, SkillRoleDepartment, SkillRoleMeta } from './types';

// Root directory for vendored agency-agents-zh markdown files.
// All skill role files live under this directory, organized by department.
const SKILLS_ROOT = join(process.cwd(), 'src', 'skills', 'agency-agents');

// Parse YAML frontmatter from a markdown file.
// Returns { frontmatter, body } where frontmatter is a plain object.
// This is a minimal parser — we only support string values and the 3
// fields we actually use (name, description, color). Anything fancier
// would need a real YAML parser dependency.
function parseFrontmatter(raw: string): { frontmatter: Record<string, string>; body: string } {
  const frontmatter: Record<string, string> = {};
  // Files must start with '---\n' and contain a closing '---\n'.
  if (!raw.startsWith('---\n')) {
    return { frontmatter, body: raw };
  }
  const end = raw.indexOf('\n---\n', 4);
  if (end === -1) {
    return { frontmatter, body: raw };
  }
  const yamlBlock = raw.slice(4, end);
  const body = raw.slice(end + 5); // skip closing '---\n'

  for (const line of yamlBlock.split('\n')) {
    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let value = m[2].trim();
    // Strip surrounding quotes if present.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    frontmatter[key] = value;
  }

  return { frontmatter, body };
}

// Resolve a role id to its absolute file path.
// The id format is '{department}/{filename-without-extension}'.
// Example: 'marketing/marketing-xiaohongshu-operator'
function idToPath(id: string): string {
  // Defensive: normalize path separators and strip any directory traversal.
  const clean = id.replace(/\.\./g, '').replace(/\\/g, '/');
  return join(SKILLS_ROOT, `${clean}.md`);
}

// Load a single role by id. Returns null if the file doesn't exist or
// the frontmatter is malformed. Throws nothing — callers can rely on
// null to mean "not found" without a try/catch.
export async function loadRole(id: string): Promise<SkillRole | null> {
  try {
    const path = idToPath(id);
    const raw = await readFile(path, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(raw);
    if (!frontmatter.name || !frontmatter.description) return null;

    // Derive department from the id prefix (before first slash).
    const department = (id.split('/')[0] || 'specialized') as SkillRoleDepartment;

    return {
      id,
      department,
      name: frontmatter.name,
      description: frontmatter.description,
      color: frontmatter.color,
      // Trim leading whitespace; the body starts with the persona prompt.
      systemPrompt: body.trim(),
    };
  } catch {
    return null;
  }
}

// Load just the meta (no systemPrompt) for a role. Faster than loadRole
// and lets us return a lightweight payload to the picker UI without
// shipping 500-token persona bodies across the wire.
export async function loadRoleMeta(id: string): Promise<SkillRoleMeta | null> {
  const full = await loadRole(id);
  if (!full) return null;
  const { systemPrompt: _ignored, ...meta } = full;
  return meta;
}
