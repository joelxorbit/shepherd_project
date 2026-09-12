const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const ImageModule = require('docxtemplater-image-module-free');
const { v4: uuidv4 } = require('uuid');
const { resizeImageToFit, getImageMetadata } = require('./imageProcessor');
const { slugifyTitle, getStorageDir } = require('../utils/fileUtils');
const docxConverter = require('docx-pdf');

const GENERATED_DOCX_DIR = getStorageDir('generated/docx');

/**
 * Convert a list of strings into a numbered plain-text block.
 */
function formatNumberedList(items) {
  if (!items || items.length === 0) return '';
  return items.map((item, i) => `${i + 1}. ${item.trim()}`).join('\n');
}

/**
 * Strip HTML tags from a string, preserving paragraph/line breaks.
 */
function htmlToPlainText(html) {
  if (!html) return '';
  return html
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Core document generation function.
 *
 * Supports the following placeholder families:
 *   Text   : EVENT_TITLE, REPORT_TITLE, OBJECTIVES, REPORT, OUTCOME, + any custom text
 *   Images : PHOTO_N, INVITATION_N, SIGNATURE_N, NEWSPAPER_N
 *
 * @param {object} params
 * @param {string}   params.templatePath        - .docx template file path
 * @param {object}   params.textData            - { PLACEHOLDER_NAME: 'value', ... }
 * @param {string[]} params.photoFilePaths       - ordered event photo paths
 * @param {string[]} params.invitationFilePaths  - invitation image paths
 * @param {string[]} params.signatureFilePaths   - signature image paths (multiple)
 * @param {string[]} params.newspaperFilePaths   - newspaper clipping paths (multiple)
 * @param {string[]} params.objectives           - objective strings
 * @param {string[]} params.outcomes             - outcome strings
 * @param {string}   params.reportDescription    - HTML from Quill
 * @param {string}   params.eventTitle           - used for output filename
 * @param {object[]} params.placeholderManifest  - from templateParser
 */
async function generateDocument(params) {
  const {
    templatePath,
    textData = {},
    photoFilePaths = [],
    invitationFilePaths = [],
    signatureFilePaths = [],
    newspaperFilePaths = [],
    eventTitle = 'document',
    placeholderManifest = [],
  } = params;

  const jobId = uuidv4();
  const slug = slugifyTitle(textData.EVENT_TITLE || textData.REPORT_TITLE || eventTitle);
  const outputFilename = `${slug}_${jobId.substring(0, 8)}.docx`;
  const outputPath = path.join(GENERATED_DOCX_DIR, outputFilename);

  // ── 1. Load the template ───────────────────────────────────────────────────
  const templateContent = fs.readFileSync(templatePath, 'binary');
  const zip = new PizZip(templateContent);

  // ── 2. Build image buffer map ──────────────────────────────────────────────
  // key = placeholder name (e.g. PHOTO_1), value = Buffer
  const imageBuffers = {};
  const imageDimensions = {}; // store exact [width, height] for each tag

  // Helper: process image to fit within max display dimensions, keeping aspect ratio
  async function processAndStoreImage(tagName, filePath, maxDisplayW, maxDisplayH) {
    if (!filePath || !fs.existsSync(filePath)) return;
    try {
      // Use 4x resolution for crisp printing, while keeping display size small
      const RESOLUTION = 4;
      
      const buf = await resizeImageToFit(
        filePath,
        Math.round(maxDisplayW * RESOLUTION),
        Math.round(maxDisplayH * RESOLUTION),
        { fit: 'inside' } // 'inside' preserves aspect ratio without adding transparent padding
      );

      let w = maxDisplayW;
      let h = maxDisplayH;
      
      // Extract exact width/height from the generated PNG buffer
      if (buf.length >= 24 && buf.toString('ascii', 12, 16) === 'IHDR') {
        w = buf.readUInt32BE(16) / RESOLUTION;
        h = buf.readUInt32BE(20) / RESOLUTION;
      }
      
      imageBuffers[tagName] = buf;
      imageDimensions[tagName] = [w, h];
    } catch (e) {
      console.warn(`[IMAGE] Could not process ${tagName} (${filePath}):`, e.message);
    }
  }

  // Event photos → PHOTO_1, PHOTO_2, …
  for (let i = 0; i < photoFilePaths.length; i++) {
    await processAndStoreImage(`PHOTO_${i + 1}`, photoFilePaths[i], 280, 180);
  }

  // Invitation images → INVITATION_1, INVITATION_2, …
  for (let i = 0; i < invitationFilePaths.length; i++) {
    await processAndStoreImage(`INVITATION_${i + 1}`, invitationFilePaths[i], 550, 750);
  }

  // Signatures → SIGNATURE_1, SIGNATURE_2, …  (also SIGNATURE as alias for first)
  for (let i = 0; i < signatureFilePaths.length; i++) {
    await processAndStoreImage(`SIGNATURE_${i + 1}`, signatureFilePaths[i], 200, 260);
    if (i === 0) {
      imageBuffers['SIGNATURE'] = imageBuffers[`SIGNATURE_1`];
      imageDimensions['SIGNATURE'] = imageDimensions[`SIGNATURE_1`];
    }
  }

  // Newspapers → NEWSPAPER_1, NEWSPAPER_2, …  (also NEWSPAPER_CLIPPING / NEWSPAPER as aliases)
  for (let i = 0; i < newspaperFilePaths.length; i++) {
    await processAndStoreImage(`NEWSPAPER_${i + 1}`, newspaperFilePaths[i], 550, 750);
    if (i === 0) {
      imageBuffers['NEWSPAPER_CLIPPING'] = imageBuffers[`NEWSPAPER_1`];
      imageBuffers['NEWSPAPER'] = imageBuffers[`NEWSPAPER_1`];
      imageDimensions['NEWSPAPER_CLIPPING'] = imageDimensions[`NEWSPAPER_1`];
      imageDimensions['NEWSPAPER'] = imageDimensions[`NEWSPAPER_1`];
    }
  }

  // ── 4. Configure ImageModule ───────────────────────────────────────────────
  const imageModule = new ImageModule({
    centered: false,
    getImage(tagValue, tagName) {
      return imageBuffers[tagName] || null;
    },
    getSize(img, tagValue, tagName) {
      // Return the dynamically calculated size from our processing step
      return imageDimensions[tagName] || [150, 150];
    },
    setParser(placeHolderContent) {
      const isImage =
        placeHolderContent.startsWith('PHOTO_') ||
        placeHolderContent.startsWith('INVITATION_') ||
        placeHolderContent.startsWith('SIGNATURE') ||
        placeHolderContent.startsWith('NEWSPAPER');

      if (isImage) {
        return {
          type: 'placeholder',
          value: placeHolderContent,
          module: 'open-xml-templating/docxtemplater-image-module',
          centered: false, // false allows inline placement so user controls alignment in Word
        };
      }
      return null;
    }
  });

  // ── 5. Build text data object ──────────────────────────────────────────────
  const data = {};

  // Copy user-supplied text values
  for (const [key, value] of Object.entries(textData)) {
    data[key] = value || '';
  }

  // Numbered lists
  if (params.objectives && params.objectives.length > 0) {
    data['OBJECTIVES'] = formatNumberedList(params.objectives);
  }
  if (params.outcomes && params.outcomes.length > 0) {
    data['OUTCOME'] = formatNumberedList(params.outcomes);
  }

  // Report description (strip HTML to plain text with linebreaks)
  if (params.reportDescription) {
    data['REPORT'] = htmlToPlainText(params.reportDescription);
    data['REPORT_DESCRIPTION'] = data['REPORT'];
  }

  // Attach image buffers into data map so image module can find them by tag name
  // IMPORTANT: docxtemplater-image-module-free crashes if we set this to a Buffer object directly.
  // We set it to true so it triggers the module, which then calls getImage(tagValue, tagName)
  // where we look up the buffer in our imageBuffers map.
  for (const [key, buf] of Object.entries(imageBuffers)) {
    data[key] = true;
  }

  // Ensure every detected TEXT placeholder has at least an empty string
  // so docxtemplater never throws "undefined tag" errors
  for (const p of placeholderManifest) {
    if (p.type === 'text' && data[p.name] === undefined) {
      data[p.name] = '';
    }
  }

  // ── 6. Render document ─────────────────────────────────────────────────────
  // KEY FIX: Use `errorHandler` to gracefully skip image placeholders that
  // have no matching buffer, instead of throwing and producing empty output.
  const doc = new Docxtemplater(zip, {
    modules: [imageModule],
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
    // nullGetter handles missing TEXT placeholders → empty string
    nullGetter(part) {
      return '';
    },
  });

  try {
    doc.render(data);
  } catch (renderErr) {
    // If the error comes from the image module for a missing image,
    // extract docxtemplater structured errors for better diagnostics
    if (renderErr.properties && renderErr.properties.errors) {
      const msgs = renderErr.properties.errors.map((e) => e.message).join('; ');
      const enhanced = new Error(`Template rendering failed: ${msgs}`);
      enhanced.properties = renderErr.properties;
      throw enhanced;
    }
    throw renderErr;
  }

  // ── 7. Write output ────────────────────────────────────────────────────────
  const outputBuffer = doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });

  if (!outputBuffer || outputBuffer.length < 100) {
    throw new Error('Generated document is empty. Check that the template is a valid .docx file.');
  }

  fs.writeFileSync(outputPath, outputBuffer);

  console.log(`[GENERATOR] Written: ${outputFilename} (${outputBuffer.length} bytes)`);

  // Convert to PDF
  const pdfFilename = `${slug}_${jobId.substring(0, 8)}.pdf`;
  const pdfPath = path.join(GENERATED_DOCX_DIR, pdfFilename);
  
  await new Promise((resolve) => {
    docxConverter(outputPath, pdfPath, (err, result) => {
      if (err) {
        console.error('[PDF] Conversion failed:', err);
        // Resolve anyway so the user at least gets the DOCX
        resolve(null);
      } else {
        console.log(`[PDF] Written: ${pdfFilename}`);
        resolve(result);
      }
    });
  });

  return {
    jobId,
    docxPath: outputPath,
    pdfPath: fs.existsSync(pdfPath) ? pdfPath : null,
    filename: outputFilename,
    pdfFilename
  };
}

module.exports = { generateDocument, htmlToPlainText, formatNumberedList };
