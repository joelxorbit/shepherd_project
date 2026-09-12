/**
 * Placeholder utilities for the Document Automation system.
 * Handles detection, classification, and normalisation of {{PLACEHOLDER}} tokens.
 */

// Regex to find all {{PLACEHOLDER}} tokens in a string
const PLACEHOLDER_REGEX = /\{\{([A-Z0-9_]+)\}\}/g;

// Known image-type placeholder prefixes
const IMAGE_PREFIXES = ['PHOTO_', 'INVITATION_', 'SIGNATURE_', 'SIGNATURE', 'NEWSPAPER_', 'NEWSPAPER', 'LOGO', 'IMAGE_'];
const LIST_PLACEHOLDERS = ['OBJECTIVES', 'OUTCOME'];
const PAGE_CONTROL = ['PAGE_BREAK', 'PHOTO_SECTION', 'SECTION_BREAK'];

/**
 * Extract all unique placeholder names from a raw XML string.
 */
function extractPlaceholders(xmlString) {
  const found = new Set();
  let match;
  const regex = new RegExp(PLACEHOLDER_REGEX.source, PLACEHOLDER_REGEX.flags);
  while ((match = regex.exec(xmlString)) !== null) {
    found.add(match[1]);
  }
  return Array.from(found).sort();
}

/**
 * Classify a placeholder as 'text', 'image', 'list', 'pageControl', or 'unknown'.
 */
function classifyPlaceholder(name) {
  if (PAGE_CONTROL.includes(name)) return 'pageControl';
  if (LIST_PLACEHOLDERS.includes(name)) return 'list';
  if (IMAGE_PREFIXES.some((prefix) => name.startsWith(prefix))) return 'image';
  return 'text';
}

/**
 * Build an annotated placeholder manifest from a raw list.
 */
function buildPlaceholderManifest(names) {
  return names.map((name) => ({
    name,
    token: `{{${name}}}`,
    type: classifyPlaceholder(name),
    required: isRequiredPlaceholder(name),
  }));
}

/**
 * Determine if a placeholder is considered "important" for user guidance.
 */
function isRequiredPlaceholder(name) {
  const important = ['EVENT_TITLE', 'REPORT_TITLE', 'REPORT', 'OBJECTIVES', 'OUTCOME'];
  return important.includes(name);
}

/**
 * Get all photo placeholder names from a manifest (e.g., PHOTO_1, PHOTO_2).
 */
function getPhotoPlaceholders(manifest) {
  return manifest
    .filter((p) => p.name.match(/^PHOTO_\d+$/))
    .sort((a, b) => {
      const numA = parseInt(a.name.split('_')[1]);
      const numB = parseInt(b.name.split('_')[1]);
      return numA - numB;
    });
}

/**
 * Map user-supplied data keys to their placeholder equivalents.
 * Supports both exact match and case-insensitive fuzzy matching.
 */
function mapDataToPlaceholders(userDataMap, placeholderNames) {
  const result = {};
  for (const name of placeholderNames) {
    // Exact match
    if (userDataMap[name] !== undefined) {
      result[name] = userDataMap[name];
      continue;
    }
    // Case-insensitive match
    const lowerName = name.toLowerCase();
    const matchKey = Object.keys(userDataMap).find(
      (k) => k.toLowerCase() === lowerName
    );
    if (matchKey) {
      result[name] = userDataMap[matchKey];
    }
  }
  return result;
}

module.exports = {
  extractPlaceholders,
  classifyPlaceholder,
  buildPlaceholderManifest,
  getPhotoPlaceholders,
  mapDataToPlaceholders,
  PLACEHOLDER_REGEX,
};
