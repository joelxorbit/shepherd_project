'use strict';

const state = {
  templates: [],
  selectedTemplate: null,
  dynamicFields: {}, // Map of fieldMapKey -> value/files
  quillEditors: {}, // Map of fieldMapKey -> Quill instance
  imagePreviews: {}, // Map of fieldMapKey -> Array of { objectUrl, file, name }
};

const $ = (id) => document.getElementById(id);

function showToast(message, type = 'info', durationMs = 4000) {
  const container = $('toast-container');
  if(!container) return;
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close">✕</button>
  `;
  toast.querySelector('.toast-close').onclick = () => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  };
  container.appendChild(toast);
  if (durationMs > 0) setTimeout(() => toast.querySelector('.toast-close').click(), durationMs);
}

function setStatus(text, type = 'ready') {
  const pill = $('status-pill');
  if(!pill) return;
  const dot = pill.querySelector('.status-dot');
  const label = pill.querySelector('.status-text');
  label.textContent = text;
  dot.className = 'status-dot';
  if (type === 'loading') dot.classList.add('loading');
  if (type === 'error')   dot.classList.add('error');
  if (type === 'warning') dot.classList.add('warning');
}

// ─── INIT ───
document.addEventListener('DOMContentLoaded', async () => {
  await fetchTemplates();
  
  $('template-select').addEventListener('change', (e) => {
    const templateId = e.target.value;
    selectTemplate(templateId);
  });

  $('generate-btn').addEventListener('click', handleGenerate);
  $('generate-another-btn').addEventListener('click', resetGenerationState);
});

async function fetchTemplates() {
  try {
    const res = await fetch('/api/public/templates');
    const data = await res.json();
    state.templates = data;
    
    const select = $('template-select');
    if (data.length === 0) {
      select.innerHTML = '<option value="" disabled selected>No templates available</option>';
      return;
    }

    select.innerHTML = '<option value="" disabled selected>Select a template...</option>' + 
      data.map(t => `<option value="${t._id}">${t.templateName}</option>`).join('');
      
  } catch (err) {
    showToast('Failed to load templates', 'error');
  }
}

function selectTemplate(templateId) {
  const template = state.templates.find(t => t._id === templateId);
  state.selectedTemplate = template;
  
  const infoCard = $('template-info-card');
  $('selected-template-name').textContent = template.templateName;
  $('selected-template-desc').textContent = template.description || 'No description';
  infoCard.classList.remove('hidden');

  const downloadBtn = $('download-sample-btn');
  if (template.templateFilename) {
    downloadBtn.href = `/api/public/templates/${template._id}/download`;
    downloadBtn.download = template.templateFilename;
    downloadBtn.classList.remove('hidden');
  } else {
    downloadBtn.classList.add('hidden');
  }

  buildDynamicForm(template);
  updateSummary();
}

// ─── DYNAMIC FORM BUILDER ───
function buildDynamicForm(template) {
  const container = $('dynamic-steps-container');
  container.innerHTML = '';
  state.dynamicFields = {};
  state.quillEditors = {};
  state.imagePreviews = {};

  template.steps.forEach((step, stepIndex) => {
    const section = document.createElement('section');
    section.className = 'form-section';
    
    let html = `
      <div class="section-header">
        <div class="section-badge">Step ${stepIndex + 2}</div>
        <h2 class="section-title">${step.title}</h2>
        ${step.description ? `<p class="section-desc">${step.description}</p>` : ''}
      </div>
    `;

    step.fields.forEach((field, fieldIndex) => {
      const fieldId = `field_${stepIndex}_${fieldIndex}`;
      const mapKey = field.placeholderMap;
      
      html += `<div class="form-group" style="margin-bottom:18px;">
        <label class="form-label">${field.label}</label>
        <span class="field-hint">Maps to <code>{{${mapKey}}}</code></span>
      `;

      if (field.type === 'text') {
        html += `<input type="text" id="${fieldId}" data-map="${mapKey}" class="form-input dynamic-text-input" placeholder="Enter ${field.label}" />`;
      } 
      else if (field.type === 'rich_text') {
        html += `<div class="quill-wrapper"><div id="${fieldId}" data-map="${mapKey}"></div></div>`;
      } 
      else if (field.type === 'image') {
        state.imagePreviews[mapKey] = [];
        html += `
          <div class="photo-upload-area dynamic-drop-zone" id="drop_${fieldId}" data-map="${mapKey}">
            <div class="photo-upload-inner">
              <div class="upload-icon small">🖼️</div>
              <p>Drag & Drop images here or</p>
              <div style="display: flex; gap: 8px; justify-content: center; margin: 4px 0;">
                <label class="btn btn-outline btn-sm" for="file_${fieldId}">Add Images</label>
                <input type="file" id="file_${fieldId}" accept="image/*" multiple hidden class="dynamic-file-input" data-map="${mapKey}" />
              </div>
            </div>
          </div>
          <div class="photo-grid" id="grid_${fieldId}"></div>
        `;
      }

      html += `</div>`;
    });

    section.innerHTML = html;
    container.appendChild(section);

    // Initialize interactive elements for this step
    step.fields.forEach((field, fieldIndex) => {
      const fieldId = `field_${stepIndex}_${fieldIndex}`;
      const mapKey = field.placeholderMap;
      
      if (field.type === 'text') {
        const input = $(fieldId);
        input.addEventListener('input', () => {
          state.dynamicFields[mapKey] = input.value;
          updateSummary();
        });
      }
      else if (field.type === 'rich_text') {
        const editor = new Quill(`#${fieldId}`, {
          theme: 'snow',
          modules: {
            toolbar: [
              ['bold', 'italic', 'underline', 'strike'],
              [{ header: [1, 2, 3, false] }],
              [{ align: '' }, { align: 'center' }, { align: 'right' }, { align: 'justify' }],
              [{ list: 'ordered' }, { list: 'bullet' }],
              [{ color: [] }, { background: [] }],
              ['blockquote', 'clean']
            ]
          }
        });
        state.quillEditors[mapKey] = editor;
        editor.on('text-change', () => {
          state.dynamicFields[mapKey] = editor.root.innerHTML;
          updateSummary();
        });
      }
      else if (field.type === 'image') {
        initDynamicImageDropzone(`drop_${fieldId}`, `file_${fieldId}`, `grid_${fieldId}`, mapKey);
      }
    });
  });
}

// ─── DYNAMIC IMAGE HANDLING & CLIENT-SIDE COMPRESSION ───

/**
 * Compress an image file client-side using HTML5 Canvas to strictly stay within Vercel's 4.5MB request limit.
 * Converts large phone/camera images (3-12MB) down to crisp, print-ready JPEGs (150-250KB).
 */
function compressImageForUpload(file, maxDimension = 1600, quality = 0.82) {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    return Promise.resolve(file);
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // If image is already smaller than maxDimension and file is < 300KB, no recompression needed
        if (width <= maxDimension && height <= maxDimension && file.size < 300 * 1024) {
          return resolve(file);
        }

        // Maintain aspect ratio
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // White background for PNG transparency
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              return resolve(file);
            }
            const cleanName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
            const compressed = new File([blob], cleanName, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            console.log(`[CLIENT COMPRESS] ${file.name}: ${(file.size / 1024).toFixed(0)}KB -> ${(compressed.size / 1024).toFixed(0)}KB (${width}x${height})`);
            resolve(compressed);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

function initDynamicImageDropzone(dropZoneId, fileInputId, gridId, mapKey) {
  const dropZone = $(dropZoneId);
  const fileInput = $(fileInputId);
  
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleDynamicImages(Array.from(e.dataTransfer.files), mapKey, gridId);
  });
  
  fileInput.addEventListener('change', () => {
    handleDynamicImages(Array.from(fileInput.files), mapKey, gridId);
    fileInput.value = '';
  });
}

function handleDynamicImages(files, mapKey, gridId) {
  const imageFiles = files.filter(f => f.type.startsWith('image/'));
  if(imageFiles.length === 0) return;

  const arr = state.imagePreviews[mapKey];
  
  imageFiles.forEach(f => {
    const item = {
      file: f,
      name: f.name,
      objectUrl: URL.createObjectURL(f)
    };
    arr.push(item);

    // Pre-compress in background to speed up generation
    compressImageForUpload(f, 1600, 0.82).then(compressed => {
      item.file = compressed;
    });
  });

  renderDynamicImageGrid(mapKey, gridId);
  updateSummary();
}

function renderDynamicImageGrid(mapKey, gridId) {
  const grid = $(gridId);
  const arr = state.imagePreviews[mapKey];
  grid.innerHTML = '';

  arr.forEach((img, idx) => {
    const card = document.createElement('div');
    card.className = 'photo-card';
    card.innerHTML = `
      <img src="${img.objectUrl}" alt="Img" loading="lazy" />
      <div class="photo-card-overlay">
        <span class="photo-slot-label">{{${mapKey}_${idx + 1}}}</span>
        <button class="icon-btn remove-btn" aria-label="Remove">✕</button>
      </div>
    `;
    card.querySelector('.remove-btn').addEventListener('click', () => {
      URL.revokeObjectURL(img.objectUrl);
      arr.splice(idx, 1);
      renderDynamicImageGrid(mapKey, gridId);
      updateSummary();
    });
    grid.appendChild(card);
  });
}


// ─── SUMMARY ───
function updateSummary() {
  const placeholder = $('preview-placeholder');
  const summary = $('content-summary');
  const list = $('summary-list');

  if (!state.selectedTemplate) {
    placeholder.classList.remove('hidden');
    summary.classList.add('hidden');
    return;
  }

  placeholder.classList.add('hidden');
  summary.classList.remove('hidden');
  
  const items = [{ icon: '📄', label: 'Template', value: state.selectedTemplate.templateName, good: true }];

  // Add fields dynamically
  Object.keys(state.dynamicFields).forEach(key => {
    const val = state.dynamicFields[key];
    if (val && val.trim().length > 0 && val !== '<p><br></p>') {
      items.push({ icon: '📝', label: key, value: val.replace(/<[^>]*>?/gm, '').substring(0, 30) + '...', good: true });
    }
  });

  Object.keys(state.imagePreviews).forEach(key => {
    const arr = state.imagePreviews[key];
    if (arr.length > 0) {
      items.push({ icon: '📷', label: key, value: `${arr.length} images`, good: true });
    }
  });

  list.innerHTML = items.map(item => `
    <li class="summary-item">
      <span class="summary-item-icon">${item.icon}</span>
      <span class="summary-item-label">${item.label}</span>
      <span class="summary-item-value good">${item.value}</span>
    </li>
  `).join('');
}


// ─── GENERATE ───
async function handleGenerate() {
  if (!state.selectedTemplate) {
    showToast('Please select a template.', 'warning');
    return;
  }

  showProgressPanel();
  
  // Use pointer-events instead of the 'disabled' attribute to prevent browser scroll jumps on focus loss
  const genBtn = $('generate-btn');
  genBtn.style.pointerEvents = 'none';
  genBtn.style.opacity = '0.6';
  
  setStatus('Generating document...', 'loading');

  // Smoothly scroll to the progress/preview panel so the user can see the status, especially on mobile
  $('preview-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const formData = new FormData();
    formData.append('templateId', state.selectedTemplate._id);

    // Text & Rich Text fields - comprehensively collect from all configured steps
    const textData = {};
    if (state.selectedTemplate && state.selectedTemplate.steps) {
      state.selectedTemplate.steps.forEach((step, sIdx) => {
        step.fields.forEach((field, fIdx) => {
          const mapKey = field.placeholderMap;
          const fieldId = `field_${sIdx}_${fIdx}`;
          if (field.type === 'text') {
            const input = $(fieldId);
            textData[mapKey] = input ? input.value : (state.dynamicFields[mapKey] || '');
          } else if (field.type === 'rich_text') {
            const editor = state.quillEditors[mapKey];
            if (editor) {
              const html = editor.root.innerHTML;
              textData[mapKey] = (html === '<p><br></p>') ? '' : html;
            } else {
              textData[mapKey] = state.dynamicFields[mapKey] || '';
            }
          }
        });
      });
    }

    // Include any additional dynamic fields that were set
    Object.keys(state.dynamicFields).forEach(key => {
      if (textData[key] === undefined) {
        textData[key] = state.dynamicFields[key];
      }
    });

    formData.append('dynamicTextData', JSON.stringify(textData));

    // 1. Optimize and compress all images client-side before upload to stay under Vercel's 4.5MB limit
    setStatus('Optimizing images for upload...', 'loading');
    for (const key of Object.keys(state.imagePreviews)) {
      const arr = state.imagePreviews[key];
      for (let i = 0; i < arr.length; i++) {
        arr[i].file = await compressImageForUpload(arr[i].file, 1600, 0.82);
      }
    }

    // 2. Check total image payload size
    let totalImgBytes = 0;
    Object.keys(state.imagePreviews).forEach(key => {
      state.imagePreviews[key].forEach(imgObj => {
        totalImgBytes += (imgObj.file.size || 0);
      });
    });

    // If total image payload is still over 3.6MB (e.g. 15+ photos), perform a second pass at 1100px & 0.72 quality
    if (totalImgBytes > 3.6 * 1024 * 1024) {
      console.warn(`[GENERATE] Total image payload (${(totalImgBytes/1024/1024).toFixed(2)}MB) approaching Vercel limit. Applying high-efficiency compression...`);
      for (const key of Object.keys(state.imagePreviews)) {
        const arr = state.imagePreviews[key];
        for (let i = 0; i < arr.length; i++) {
          arr[i].file = await compressImageForUpload(arr[i].file, 1100, 0.72);
        }
      }
    }

    // Append images
    Object.keys(state.imagePreviews).forEach(key => {
      const arr = state.imagePreviews[key];
      arr.forEach(imgObj => {
        formData.append(key, imgObj.file);
      });
    });

    setStatus('Generating document...', 'loading');
    const res = await fetch('/api/document/generate-dynamic', {
      method: 'POST',
      body: formData,
    });

    if (res.status === 413) {
      throw new Error('Upload size exceeded serverless payload limit (413). Please upload fewer or smaller images.');
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Generation failed');

    showDownloadPanel(data);
    setStatus('Document ready', 'ready');
    showToast('Document generated successfully!', 'success');
  } catch (err) {
    hideProgressPanel();
    const genBtn = $('generate-btn');
    genBtn.style.pointerEvents = 'auto';
    genBtn.style.opacity = '1';
    setStatus('Generation failed', 'error');
    showToast(`Generation error: ${err.message}`, 'error', 8000);
  }
}

function showProgressPanel() {
  $('preview-placeholder').classList.add('hidden');
  $('content-summary').classList.add('hidden');
  $('download-panel').classList.add('hidden');
  $('progress-panel').classList.remove('hidden');
}

function hideProgressPanel() {
  $('progress-panel').classList.add('hidden');
  updateSummary();
}

function base64ToBlobUrl(base64, mimeType) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  return URL.createObjectURL(blob);
}

function showDownloadPanel(data) {
  $('progress-panel').classList.add('hidden');
  $('download-panel').classList.remove('hidden');
  $('download-filename').textContent = data.filename;
  
  if (state.docxDownloadUrl) URL.revokeObjectURL(state.docxDownloadUrl);

  state.docxDownloadUrl = base64ToBlobUrl(data.docxBase64, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  $('docx-download-btn').href = state.docxDownloadUrl;
  $('docx-download-btn').download = data.filename;
}

function resetGenerationState() {
  $('download-panel').classList.add('hidden');
  const genBtn = $('generate-btn');
  genBtn.style.pointerEvents = 'auto';
  genBtn.style.opacity = '1';
  updateSummary();
  setStatus('Ready', 'ready');
}
