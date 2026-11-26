const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const ImageModule = require('docxtemplater-image-module-free');
const { v4: uuidv4 } = require('uuid');
const { resizeImageToFit, getImageMetadata } = require('./imageProcessor');
const { slugifyTitle, getStorageDir } = require('../utils/fileUtils');
const { parseTemplateBuffer } = require('./templateParser');
const { DOMParser } = require('@xmldom/xmldom');

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

function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parseColorToHex(colorStr) {
  if (!colorStr) return null;
  const hexMatch = colorStr.match(/#([0-9a-fA-F]{3,6})/);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    return hex.toUpperCase();
  }
  const rgbMatch = colorStr.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, '0');
    const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, '0');
    const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, '0');
    return `${r}${g}${b}`.toUpperCase();
  }
  return null;
}

function cleanHtmlForXml(html) {
  if (!html) return '';
  return html
    .replace(/&nbsp;/gi, ' ')
    .replace(/<br\s*\/?>/gi, '<br/>')
    .replace(/<hr\s*\/?>/gi, '<hr/>')
    .replace(/<img([^>]*?)(?<!\/)>/gi, '<img$1/>')
    .replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
}

/**
 * Convert rich text HTML into valid Word OpenXML paragraphs,
 * preserving bold, italic, underline, strike, lists, and setting justified alignment.
 */
function convertHtmlToWordXml(html, defaultJustify = true) {
  if (!html || typeof html !== 'string') return '';

  const clean = cleanHtmlForXml(html.trim());
  const wrapped = `<root>${clean}</root>`;

  let doc;
  try {
    const parser = new DOMParser({ onError: () => {} });
    doc = parser.parseFromString(wrapped, 'text/xml');
  } catch (e) {
    return `<w:p><w:pPr><w:jc w:val="${defaultJustify ? 'both' : 'left'}"/></w:pPr><w:r><w:t>${escapeXml(html)}</w:t></w:r></w:p>`;
  }

  const root = doc ? doc.documentElement : null;
  if (!root) {
    return `<w:p><w:pPr><w:jc w:val="${defaultJustify ? 'both' : 'left'}"/></w:pPr><w:r><w:t>${escapeXml(html)}</w:t></w:r></w:p>`;
  }

  const paragraphs = [];

  function processNode(node, style = {}, currentRuns = []) {
    if (!node) return;

    if (node.nodeType === 3) {
      const text = node.nodeValue;
      if (text && text.length > 0) {
        currentRuns.push({ text, style: { ...style } });
      }
      return;
    }

    if (node.nodeType === 1) {
      const tag = node.tagName.toLowerCase();
      const cls = node.getAttribute('class') || '';
      const styleAttr = node.getAttribute('style') || '';

      let align = style.align;
      if (cls.includes('ql-align-center') || styleAttr.includes('text-align: center')) align = 'center';
      else if (cls.includes('ql-align-right') || styleAttr.includes('text-align: right')) align = 'right';
      else if (cls.includes('ql-align-justify') || styleAttr.includes('text-align: justify')) align = 'both';
      else if (cls.includes('ql-align-left') || styleAttr.includes('text-align: left')) align = 'left';

      const newStyle = { ...style };
      if (align) newStyle.align = align;
      if (tag === 'strong' || tag === 'b' || styleAttr.includes('font-weight: bold')) newStyle.bold = true;
      if (tag === 'em' || tag === 'i' || styleAttr.includes('font-style: italic')) newStyle.italic = true;
      if (tag === 'u' || styleAttr.includes('text-decoration: underline')) newStyle.underline = true;
      if (tag === 's' || tag === 'strike' || tag === 'del' || styleAttr.includes('line-through')) newStyle.strike = true;

      const colorHex = parseColorToHex(styleAttr);
      if (colorHex) newStyle.color = colorHex;

      if (tag === 'h1') { newStyle.bold = true; newStyle.size = 36; }
      if (tag === 'h2') { newStyle.bold = true; newStyle.size = 30; }
      if (tag === 'h3') { newStyle.bold = true; newStyle.size = 26; }

      if (tag === 'br') {
        currentRuns.push({ br: true });
        return;
      }

      const isBlock = ['p', 'div', 'li', 'h1', 'h2', 'h3'].includes(tag);
      if (isBlock) {
        const pRuns = [];
        const isListItem = tag === 'li';
        const parentTag = node.parentNode ? node.parentNode.tagName.toLowerCase() : '';
        const isOrdered = parentTag === 'ol';

        if (isListItem) {
          if (isOrdered) {
            let idx = 1;
            let prev = node.previousSibling;
            while (prev) {
              if (prev.nodeType === 1 && prev.tagName.toLowerCase() === 'li') idx++;
              prev = prev.previousSibling;
            }
            pRuns.push({ text: `${idx}. `, style: { bold: true } });
          } else {
            pRuns.push({ text: '• ', style: { bold: true } });
          }
        }

        const children = node.childNodes;
        for (let i = 0; i < children.length; i++) {
          processNode(children[i], newStyle, pRuns);
        }

        if (pRuns.length > 0) {
          paragraphs.push({
            runs: pRuns,
            align: newStyle.align || (defaultJustify ? 'both' : 'left'),
            isListItem
          });
        }
      } else {
        const children = node.childNodes;
        for (let i = 0; i < children.length; i++) {
          processNode(children[i], newStyle, currentRuns);
        }
      }
    }
  }

  const topRuns = [];
  const children = root.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const tag = child.tagName ? child.tagName.toLowerCase() : '';
    if (['p', 'div', 'ul', 'ol', 'h1', 'h2', 'h3'].includes(tag)) {
      if (topRuns.length > 0) {
        paragraphs.push({ runs: [...topRuns], align: defaultJustify ? 'both' : 'left' });
        topRuns.length = 0;
      }
      processNode(child, {}, []);
    } else {
      processNode(child, {}, topRuns);
    }
  }
  if (topRuns.length > 0) {
    paragraphs.push({ runs: topRuns, align: defaultJustify ? 'both' : 'left' });
  }

  if (paragraphs.length === 0) {
    return `<w:p><w:pPr><w:jc w:val="${defaultJustify ? 'both' : 'left'}"/></w:pPr><w:r><w:t></w:t></w:r></w:p>`;
  }

  return paragraphs.map(p => {
    let pPr = `<w:pPr><w:jc w:val="${p.align || (defaultJustify ? 'both' : 'left')}"/><w:spacing w:line="276" w:lineRule="auto" w:after="120"/>`;
    if (p.isListItem) {
      pPr += `<w:ind w:left="720" w:hanging="360"/>`;
    }
    pPr += `</w:pPr>`;

    const runsXml = p.runs.map(r => {
      if (r.br) return '<w:r><w:br/></w:r>';
      let rPr = '<w:rPr>';
      if (r.style) {
        if (r.style.bold) rPr += '<w:b/>';
        if (r.style.italic) rPr += '<w:i/>';
        if (r.style.underline) rPr += '<w:u w:val="single"/>';
        if (r.style.strike) rPr += '<w:strike/>';
        if (r.style.color) rPr += `<w:color w:val="${r.style.color}"/>`;
        if (r.style.size) rPr += `<w:sz w:val="${r.style.size}"/>`;
      }
      rPr += '</w:rPr>';

      return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(r.text)}</w:t></w:r>`;
    }).join('');

    return `<w:p>${pPr}${runsXml}</w:p>`;
  }).join('');
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
      
      // Extract exact width/height from the generated JPEG buffer
      if (buf.info && buf.info.width && buf.info.height) {
        w = buf.info.width / RESOLUTION;
        h = buf.info.height / RESOLUTION;
      } else if (buf.length >= 24 && buf.toString('ascii', 12, 16) === 'IHDR') {
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
    if (keyLower.includes('photo') || keyLower.includes('img')) { w = 280; h = 180; }
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
      // Dynamically check if an image was uploaded for this exact placeholder
      const isImage = !!imageBuffers[placeHolderContent];

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
  const htmlKeys = [];

  // Copy user-supplied dynamic text values
  for (const [key, value] of Object.entries(dynamicTextData)) {
    if (value && typeof value === 'string' && (value.includes('<') || value.includes('\n'))) {
      htmlKeys.push(key);
      data[key] = convertHtmlToWordXml(value, true);
    } else {
      data[key] = value || '';
    }
  }

  // Pre-process Word XML to convert HTML placeholders into raw XML tags {{@KEY}}
  // without deleting other paragraphs or crossing page breaks!
  function prepareWordXmlForHtmlTag(xml, key) {
    if (!xml) return xml;

    // Pattern 1: A paragraph that contains {{...key...}} strictly within a single <w:p>...</w:p>
    const singlePRegex = new RegExp(
      `<w:p\\b(?:(?!<\\/w:p>)[\\s\\S])*?\\{\\{(?:(?!<\\/w:p>)[^{}])*?\\b${key}\\b(?:(?!<\\/w:p>)[^{}])*?\\}\\}(?:(?!<\\/w:p>)[\\s\\S])*?<\\/w:p>`,
      'g'
    );

    // If the paragraph also contains drawings or textboxes (<w:drawing or <w:pict),
    // do not destroy the drawings/shapes. Instead, isolate the tag!
    xml = xml.replace(singlePRegex, (pXml) => {
      if (pXml.includes('<w:drawing') || pXml.includes('<w:pict')) {
        const tagRunRegex = new RegExp(`<w:r\\b(?:(?!<\\/w:r>)[\\s\\S])*?\\{\\{(?:(?!<\\/w:r>)[^{}])*?\\b${key}\\b(?:(?!<\\/w:r>)[^{}])*?\\}\\}(?:(?!<\\/w:r>)[\\s\\S])*?<\\/w:r>`);
        const cleanedP = pXml.replace(tagRunRegex, '');
        return `${cleanedP}<w:p><w:r><w:t>{{@${key}}}</w:t></w:r></w:p>`;
      } else {
        const pPrMatch = pXml.match(/<w:pPr\b[\s\S]*?<\/w:pPr>/);
        const pPr = pPrMatch ? pPrMatch[0] : '';
        return `<w:p>${pPr}<w:r><w:t>{{@${key}}}</w:t></w:r></w:p>`;
      }
    });

    // Pattern 2: What if {{key}} was inside a run in a paragraph with nested <w:p> or shapes (like CONCLUSION_CONTENT)?
    if (!xml.includes(`{{@${key}}}`)) {
      const tagRunRegex = new RegExp(`<w:r\\b(?:(?!<\\/w:r>)[\\s\\S])*?\\{\\{(?:(?!<\\/w:r>)[^{}])*?\\b${key}\\b(?:(?!<\\/w:r>)[^{}])*?\\}\\}(?:(?!<\\/w:r>)[\\s\\S])*?<\\/w:r>`);
      if (tagRunRegex.test(xml)) {
        xml = xml.replace(tagRunRegex, () => {
          return `</w:p><w:p><w:r><w:t>{{@${key}}}</w:t></w:r></w:p><w:p>`;
        });
      }
    }

    return xml;
  }

  Object.keys(zip.files).forEach((fileName) => {
    if (fileName.match(/^word\/(document|header\d*|footer\d*)\.xml$/)) {
      let fileXml = zip.files[fileName].asText();
      let modified = false;
      htmlKeys.forEach(key => {
        const updated = prepareWordXmlForHtmlTag(fileXml, key);
        if (updated !== fileXml) {
          fileXml = updated;
          modified = true;
        }
      });
      if (modified) {
        zip.file(fileName, fileXml);
      }
    }
  });

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

  // Read file into base64
  const docxBase64 = fs.readFileSync(outputPath, { encoding: 'base64' });

  // Cleanup tmp file immediately to keep Vercel stateless environment clean
  fs.unlinkSync(outputPath);

  return {
    jobId,
    filename: outputFilename,
    docxBase64
  };
}

module.exports = { generateDocument, htmlToPlainText, formatNumberedList, convertHtmlToWordXml };
