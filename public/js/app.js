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
          modules: { toolbar: [['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['clean']] }
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

// ─── DYNAMIC IMAGE HANDLING ───
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
    arr.push({
      file: f,
      name: f.name,
      objectUrl: URL.createObjectURL(f)
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
  $('generate-btn').disabled = true;
  setStatus('Generating document...', 'loading');

  try {
    const formData = new FormData();
    formData.append('templateId', state.selectedTemplate._id);

    // Text & Rich Text fields
    const textData = {};
    Object.keys(state.dynamicFields).forEach(key => {
      textData[key] = state.dynamicFields[key];
    });
    formData.append('dynamicTextData', JSON.stringify(textData));

    // Images
    Object.keys(state.imagePreviews).forEach(key => {
      const arr = state.imagePreviews[key];
      arr.forEach(imgObj => {
        // We append them using the key, multer will parse them into an array under this field name
        formData.append(key, imgObj.file);
      });
    });

    const data = await fetch('/api/document/generate-dynamic', {
      method: 'POST',
      body: formData,
    }).then(async r => {
      const json = await r.json();
      if (!r.ok) throw new Error(json.message || 'Generation failed');
      return json;
    });

    showDownloadPanel(data);
    setStatus('Document ready', 'ready');
    showToast('Document generated successfully!', 'success');
  } catch (err) {
    hideProgressPanel();
    $('generate-btn').disabled = false;
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
  if (state.pdfDownloadUrl) URL.revokeObjectURL(state.pdfDownloadUrl);

  state.docxDownloadUrl = base64ToBlobUrl(data.docxBase64, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  $('docx-download-btn').href = state.docxDownloadUrl;
  $('docx-download-btn').download = data.filename;

  const pdfBtn = $('pdf-download-btn');
  if (data.pdfBase64) {
    state.pdfDownloadUrl = base64ToBlobUrl(data.pdfBase64, 'application/pdf');
    pdfBtn.href = state.pdfDownloadUrl;
    pdfBtn.download = data.pdfFilename || data.filename.replace('.docx', '.pdf');
    pdfBtn.style.display = 'inline-flex';
  } else {
    pdfBtn.style.display = 'none';
  }
}

function resetGenerationState() {
  $('download-panel').classList.add('hidden');
  $('generate-btn').disabled = false;
  updateSummary();
  setStatus('Ready', 'ready');
}
