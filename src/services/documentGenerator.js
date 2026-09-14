const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const ImageModule = require('docxtemplater-image-module-free');
const { v4: uuidv4 } = require('uuid');
const { resizeImageToFit, getImageMetadata } = require('./imageProcessor');
const { slugifyTitle, getStorageDir } = require('../utils/fileUtils');
const docxConverter = require('docx-pdf');
const { parseTemplateBuffer } = require('./templateParser');

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
 * @param {Buffer}   params.templateBuffer        - .docx template file buffer
 * @param {object}   params.textData            - { PLACEHOLDER_NAME: 'value', ... }
 * @param {Buffer[]} params.photoBuffers       - ordered event photo buffers
 * @param {Buffer[]} params.invitationBuffers  - invitation image buffers
 * @param {Buffer[]} params.signatureBuffers   - signature image buffers (multiple)
 * @param {Buffer[]} params.newspaperBuffers   - newspaper clipping buffers (multiple)
 * @param {string[]} params.objectives           - objective strings
 * @param {string[]} params.outcomes             - outcome strings
 * @param {string}   params.reportDescription    - HTML from Quill
 * @param {string}   params.eventTitle           - used for output filename
 */
async function generateDocument(params) {
  const {
    templateBuffer,
    dynamicTextData = {},
    dynamicImageBuffers = {},
    eventTitle = 'document',
  } = params;

  const jobId = uuidv4();
  const slug = slugifyTitle(dynamicTextData.EVENT_TITLE || dynamicTextData.REPORT_TITLE || eventTitle);
  const outputFilename = `${slug}_${jobId.substring(0, 8)}.docx`;
  const outputPath = path.join(GENERATED_DOCX_DIR, outputFilename);

  // ── 1. Parse the template ───────────────────────────────────────────────────
  const { placeholders: placeholderManifest } = await parseTemplateBuffer(templateBuffer);
  const zip = new PizZip(templateBuffer);

  // ── 2. Build image buffer map ──────────────────────────────────────────────
  // key = placeholder name (e.g. PHOTO_1), value = Buffer
  const imageBuffers = {};
  const imageDimensions = {}; // store exact [width, height] for each tag

  // Helper: process image to fit within max display dimensions, keeping aspect ratio
  async function processAndStoreImage(tagName, buffer, maxDisplayW, maxDisplayH) {
    if (!buffer) return;
    try {
      // Use 4x resolution for crisp printing, while keeping display size small
      const RESOLUTION = 4;
      
      const buf = await resizeImageToFit(
        buffer,
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
      console.warn(`[IMAGE] Could not process ${tagName}:`, e.message);
    }
  }

  // ── 3. Process Dynamic Image Buffers ──────────────────────────────────────
  for (const [mapKey, buffers] of Object.entries(dynamicImageBuffers)) {
    let w = 400, h = 400; // generic fallback
    const keyLower = mapKey.toLowerCase();
    
    // Attempt to infer size from name
    if (keyLower.includes('photo')) { w = 280; h = 180; }
    else if (keyLower.includes('invit')) { w = 550; h = 750; }
    else if (keyLower.includes('sign')) { w = 200; h = 260; }
    else if (keyLower.includes('news')) { w = 550; h = 750; }

    for (let i = 0; i < buffers.length; i++) {
      await processAndStoreImage(`${mapKey}_${i + 1}`, buffers[i], w, h);
      if (i === 0) {
        // Alias the first image to the base mapKey (e.g. PHOTO maps to PHOTO_1)
        imageBuffers[mapKey] = imageBuffers[`${mapKey}_1`];
        imageDimensions[mapKey] = imageDimensions[`${mapKey}_1`];
      }
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

  // Copy user-supplied dynamic text values
  for (const [key, value] of Object.entries(dynamicTextData)) {
    // If it looks like HTML from a rich text field, strip it
    if (value && typeof value === 'string' && value.includes('<')) {
      data[key] = htmlToPlainText(value);
    } else {
      data[key] = value || '';
    }
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

  console.log(`[GENERATOR] Written DOCX to tmp: ${outputFilename} (${outputBuffer.length} bytes)`);

  // Convert to PDF
  const pdfFilename = `${slug}_${jobId.substring(0, 8)}.pdf`;
  const pdfPath = path.join(GENERATED_DOCX_DIR, pdfFilename);
  
  await new Promise((resolve) => {
    docxConverter(outputPath, pdfPath, (err, result) => {
      if (err) {
        console.error('[PDF] Conversion failed:', err);
        resolve(null);
      } else {
        console.log(`[PDF] Written PDF to tmp: ${pdfFilename}`);
        resolve(result);
      }
    });
  });

  // Read files into base64
  const docxBase64 = fs.readFileSync(outputPath, { encoding: 'base64' });
  const pdfBase64 = fs.existsSync(pdfPath) ? fs.readFileSync(pdfPath, { encoding: 'base64' }) : null;

  // Cleanup tmp files immediately to keep Vercel stateless environment clean
  fs.unlinkSync(outputPath);
  if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);

  return {
    jobId,
    filename: outputFilename,
    pdfFilename,
    docxBase64,
    pdfBase64
  };
}

module.exports = { generateDocument, htmlToPlainText, formatNumberedList };
