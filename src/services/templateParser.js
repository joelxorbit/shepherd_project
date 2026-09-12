const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const { extractPlaceholders, buildPlaceholderManifest } = require('../utils/placeholderUtils');

/**
 * Parse a .docx template file and extract all {{PLACEHOLDER}} tokens.
 */
async function parseTemplate(filePath) {
  const content = fs.readFileSync(filePath, 'binary');
  return parseTemplateBuffer(content);
}

/**
 * Parse a .docx template buffer
 */
async function parseTemplateBuffer(content) {
  const zip = new PizZip(content);

  // Read the main document XML
  const documentXml = zip.files['word/document.xml']
    ? zip.files['word/document.xml'].asText()
    : '';

  // Also scan header/footer files for placeholders there
  const headerFooterXmls = Object.keys(zip.files)
    .filter((name) => name.match(/^word\/(header|footer)\d*\.xml$/))
    .map((name) => zip.files[name].asText())
    .join('\n');

  const combinedXml = documentXml + '\n' + headerFooterXmls;

  // Strategy 1: scan raw XML (finds tokens on a single run)
  const namesFromRaw = extractPlaceholders(combinedXml);

  // Strategy 2: collapse all <w:t> text content within each paragraph,
  // then scan the collapsed text. This catches tokens Word has split across runs.
  const collapsedText = collapseWordXmlText(combinedXml);
  const namesFromCollapsed = extractPlaceholders(collapsedText);

  // Merge both sets
  const allNames = Array.from(new Set([...namesFromRaw, ...namesFromCollapsed])).sort();
  const manifest = buildPlaceholderManifest(allNames);

  return {
    placeholders: manifest,
    rawXml: documentXml,
    templatePath: filePath,
  };
}

/**
 * Extract all text content from <w:t> elements in Word XML and join it.
 * This collapses split runs so we can detect placeholders across run boundaries.
 */
function collapseWordXmlText(xml) {
  // Extract all text between <w:t...> and </w:t> tags
  const textParts = [];
  const re = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let match;
  while ((match = re.exec(xml)) !== null) {
    textParts.push(match[1]);
  }
  return textParts.join('');
}


/**
 * Check if a file path points to a valid, readable .docx file.
 */
function validateDocxFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error('Template file not found on server');
  }
  try {
    const content = fs.readFileSync(filePath, 'binary');
    const zip = new PizZip(content);
    if (!zip.files['word/document.xml']) {
      throw new Error('Invalid .docx file: missing document.xml');
    }
  } catch (err) {
    throw new Error(`Template file is corrupted or not a valid .docx: ${err.message}`);
  }
}

module.exports = { parseTemplate, parseTemplateBuffer, validateDocxFile };
