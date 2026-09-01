export interface YaraStringDef {
  identifier: string; // e.g. "s1" (without the leading $)
  type: 'text' | 'hex' | 'regex';
  value: string;
  nocase?: boolean;
  wide?: boolean;
  ascii?: boolean;
  fullword?: boolean;
}

export interface YaraHashes {
  md5?: string;
  sha1?: string;
  sha256?: string;
}

export interface YaraRuleInput {
  name: string;
  description?: string;
  author?: string;
  reference?: string;
  tags?: string[];
  strings?: YaraStringDef[];
  hashes?: YaraHashes;
  condition: string;
}

const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,127}$/;
const HASH_RE: Record<keyof YaraHashes, RegExp> = {
  md5: /^[a-f0-9]{32}$/i,
  sha1: /^[a-f0-9]{40}$/i,
  sha256: /^[a-f0-9]{64}$/i,
};

export interface YaraValidationError {
  field: string;
  message: string;
}

/**
 * Structural validation only — this does not compile the rule with a real
 * YARA engine, since no yara binary/binding is bundled with the app. It
 * catches the mistakes analysts actually make when hand-assembling rules:
 * bad identifiers, empty sections, malformed hex strings, unbalanced hex
 * braces, condition referencing a string identifier that was never defined.
 */
export function validateYaraRule(input: YaraRuleInput): YaraValidationError[] {
  const errors: YaraValidationError[] = [];

  if (!input.name || !IDENTIFIER_RE.test(input.name)) {
    errors.push({ field: 'name', message: 'Rule name must start with a letter or underscore and contain only letters, numbers, and underscores (max 128 chars).' });
  }

  const strings = input.strings ?? [];
  const seenIds = new Set<string>();
  for (const s of strings) {
    if (!s.identifier || !IDENTIFIER_RE.test(s.identifier)) {
      errors.push({ field: `strings.${s.identifier}`, message: `String identifier "${s.identifier}" is invalid.` });
      continue;
    }
    if (seenIds.has(s.identifier)) {
      errors.push({ field: `strings.${s.identifier}`, message: `Duplicate string identifier "$${s.identifier}".` });
    }
    seenIds.add(s.identifier);

    if (!s.value || !s.value.trim()) {
      errors.push({ field: `strings.${s.identifier}`, message: `String "$${s.identifier}" has no value.` });
      continue;
    }

    if (s.type === 'hex') {
      const hex = s.value.trim().replace(/^\{|\}$/g, '').trim();
      const tokens = hex.split(/\s+/).filter(Boolean);
      const validToken = /^([A-Fa-f0-9]{2}|\?\?|\?[A-Fa-f0-9]|[A-Fa-f0-9]\?)$/;
      if (tokens.length === 0 || !tokens.every((t) => validToken.test(t))) {
        errors.push({ field: `strings.${s.identifier}`, message: `Hex string "$${s.identifier}" contains invalid byte tokens. Use pairs of hex digits or ?? wildcards, e.g. "6A 40 ?? 00".` });
      }
    }

    if (s.type === 'regex') {
      try {
        // eslint-disable-next-line no-new
        new RegExp(s.value);
      } catch {
        errors.push({ field: `strings.${s.identifier}`, message: `Regex string "$${s.identifier}" is not a valid regular expression.` });
      }
    }
  }

  const hashes = input.hashes ?? {};
  for (const key of ['md5', 'sha1', 'sha256'] as const) {
    const v = hashes[key];
    if (v && !HASH_RE[key].test(v)) {
      errors.push({ field: `hashes.${key}`, message: `${key.toUpperCase()} hash is not a valid ${key === 'md5' ? '32' : key === 'sha1' ? '40' : '64'}-character hex string.` });
    }
  }

  if (!input.condition || !input.condition.trim()) {
    errors.push({ field: 'condition', message: 'A condition is required.' });
  } else {
    // Loose check: any $identifier referenced in the condition should exist among defined strings,
    // unless the condition uses "them" (refers to all strings) or wildcards like $s*.
    const refs = input.condition.match(/\$[a-zA-Z_][a-zA-Z0-9_]*/g) ?? [];
    for (const ref of refs) {
      const id = ref.slice(1);
      if (!seenIds.has(id)) {
        errors.push({ field: 'condition', message: `Condition references "${ref}" which is not defined in the strings section.` });
      }
    }
  }

  return errors;
}

function formatStringDef(s: YaraStringDef): string {
  const modifiers: string[] = [];
  if (s.nocase) modifiers.push('nocase');
  if (s.wide) modifiers.push('wide');
  if (s.ascii) modifiers.push('ascii');
  if (s.fullword) modifiers.push('fullword');
  const modStr = modifiers.length > 0 ? ` ${modifiers.join(' ')}` : '';

  if (s.type === 'hex') {
    const hex = s.value.trim().replace(/^\{|\}$/g, '').trim();
    return `        $${s.identifier} = { ${hex} }`;
  }
  if (s.type === 'regex') {
    return `        $${s.identifier} = /${s.value}/${modStr}`;
  }
  const escaped = s.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `        $${s.identifier} = "${escaped}"${modStr}`;
}

/**
 * Renders a YARA rule as text from structured input. Assumes the input has
 * already passed validateYaraRule (or the caller accepts a best-effort render
 * of an invalid rule for live preview purposes).
 */
export function buildYaraRuleText(input: YaraRuleInput): string {
  const lines: string[] = [];
  // "hash." is only meaningful in the condition if the analyst actually referenced
  // the hash module there (e.g. via the "insert hash check" helper) — hashes stored
  // as metadata alone should not silently change what the rule matches on.
  const needsHashModule = /\bhash\./.test(input.condition ?? '');

  if (needsHashModule) {
    lines.push('import "hash"');
    lines.push('');
  }

  lines.push(`rule ${input.name || 'Unnamed_Rule'}`);
  lines.push('{');

  const hasMeta = input.author || input.description || input.reference || (input.tags && input.tags.length > 0);
  if (hasMeta) {
    lines.push('    meta:');
    if (input.author) lines.push(`        author = "${input.author.replace(/"/g, '\\"')}"`);
    if (input.description) lines.push(`        description = "${input.description.replace(/"/g, '\\"')}"`);
    if (input.reference) lines.push(`        reference = "${input.reference.replace(/"/g, '\\"')}"`);
    if (input.tags && input.tags.length > 0) lines.push(`        tags = "${input.tags.join(', ')}"`);
    lines.push(`        date = "${new Date().toISOString().slice(0, 10)}"`);
    lines.push('');
  }

  const strings = input.strings ?? [];
  if (strings.length > 0) {
    lines.push('    strings:');
    for (const s of strings) {
      lines.push(formatStringDef(s));
    }
    lines.push('');
  }

  lines.push('    condition:');
  const userCondition = input.condition?.trim() || 'false';
  lines.push(`        ${userCondition}`);
  lines.push('}');

  return lines.join('\n');
}
