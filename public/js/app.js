/* ═══════════════════════════════════════════════════════════
   Document Automation – Frontend Application
   ═══════════════════════════════════════════════════════════ */

'use strict';

// ─── Application State ───────────────────────────────────────
const state = {
  templateId: null,
  templateFilename: null,
  templatePlaceholders: [],

  // Event photos
  photoFileIds: [],
  photoLocalPreviews: [],     // { fileId, objectUrl, name }

  // Invitation images
  invitationFileIds: [],
  invitationLocalPreviews: [],

  // Signatures (multiple)
  signatureFileIds: [],
  signatureLocalPreviews: [],

  // Newspaper clippings (multiple)
  newspaperFileIds: [],
  newspaperLocalPreviews: [],

  quillEditor: null,
  objectives: [],
  outcomes: [],

  jobId: null,
  docxFilename: null,
};

// ─── DOM Refs ─────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

// ─── Toast ────────────────────────────────────────────────────
function showToast(message, type = 'info', durationMs = 4000) {
  const container = $('toast-container');
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" aria-label="Close">✕</button>
  `;
  toast.querySelector('.toast-close').onclick = () => removeToast(toast);
  container.appendChild(toast);
  if (durationMs > 0) setTimeout(() => removeToast(toast), durationMs);
}

function removeToast(toast) {
  toast.style.opacity = '0';
  toast.style.transform = 'translateY(10px)';
  toast.style.transition = 'all 0.3s ease';
  setTimeout(() => toast.remove(), 300);
}

// ─── Utilities ────────────────────────────────────────────────
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function setStatus(text, type = 'ready') {
  const pill = $('status-pill');
  const dot = pill.querySelector('.status-dot');
  const label = pill.querySelector('.status-text');
  label.textContent = text;
  dot.className = 'status-dot';
  if (type === 'loading') dot.classList.add('loading');
  if (type === 'error')   dot.classList.add('error');
  if (type === 'warning') dot.classList.add('warning');
}

// ════════════════════════════════════════════════════════════
// STEP 1 – TEMPLATE UPLOAD
// ════════════════════════════════════════════════════════════

function initTemplateUpload() {
  const dropZone  = $('template-drop-zone');
  const fileInput = $('template-file-input');

  dropZone.addEventListener('dragover',  (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleTemplateFile(file);
  });
  dropZone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleTemplateFile(fileInput.files[0]); });
  $('template-remove-btn').addEventListener('click', resetTemplate);
}

async function handleTemplateFile(file) {
  if (!file.name.toLowerCase().endsWith('.docx')) {
    showToast('Only .docx Word templates are supported.', 'error');
    return;
  }

  $('template-file-card').classList.remove('hidden');
  $('template-drop-zone').classList.add('hidden');
  $('template-file-name').textContent = file.name;
  $('template-file-size').textContent = formatSize(file.size);
  $('template-upload-status').textContent = 'Uploading...';
  $('template-upload-status').className = 'badge badge-warning';
  setStatus('Uploading template...', 'loading');

  try {
    const formData = new FormData();
    formData.append('template', file);

    const data = await fetch('/api/template/upload', { method: 'POST', body: formData })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.message || 'Upload failed');
        return json;
      });

    state.templateId = data.templateId;
    state.templateFilename = data.filename;
    state.templatePlaceholders = data.placeholders || [];

    $('template-upload-status').textContent = '✓ Analyzed';
    $('template-upload-status').className = 'badge badge-success';
    setStatus('Template loaded', 'ready');
    showToast(`Template uploaded — ${data.placeholders.length} placeholder(s) found.`, 'success');

    renderPlaceholderPanel(data.placeholders);
    updateCustomMappingSection(data.placeholders);
    updateSummary();
  } catch (err) {
    $('template-upload-status').textContent = '✗ Error';
    $('template-upload-status').className = 'badge badge-danger';
    setStatus('Upload failed', 'error');
    showToast(`Template error: ${err.message}`, 'error', 7000);
  }
}

function resetTemplate() {
  state.templateId = null;
  state.templateFilename = null;
  state.templatePlaceholders = [];
  $('template-file-card').classList.add('hidden');
  $('template-drop-zone').classList.remove('hidden');
  $('template-file-input').value = '';
  $('placeholder-panel').classList.add('hidden');
  $('custom-mapping-list').innerHTML = '<p class="text-muted" id="custom-mapping-empty">Upload a template to see unmapped placeholders here.</p>';
  setStatus('Ready', 'ready');
  updateSummary();
}

function renderPlaceholderPanel(placeholders) {
  const panel = $('placeholder-panel');
  const grid  = $('placeholder-grid');
  const count = $('placeholder-count');
  const warn  = $('no-placeholder-warning');

  panel.classList.remove('hidden');

  if (!placeholders || placeholders.length === 0) {
    grid.innerHTML = '';
    warn.classList.remove('hidden');
    count.textContent = '0 placeholders';
    return;
  }

  warn.classList.add('hidden');
  count.textContent = `${placeholders.length} placeholder${placeholders.length > 1 ? 's' : ''}`;

  const typeIcons = { text: '📝', image: '🖼️', list: '📋', pageControl: '📄' };
  grid.innerHTML = placeholders.map((p) => `
    <div class="placeholder-tag type-${p.type}" title="${p.type} placeholder">
      <span class="tag-icon">${typeIcons[p.type] || '•'}</span>${p.token}
    </div>
  `).join('');
}

// ════════════════════════════════════════════════════════════
// GENERIC MULTI-IMAGE GRID UPLOADER
// Used for Photos, Invitation, Signature, Newspaper
// ════════════════════════════════════════════════════════════

/**
 * Set up a multi-image upload zone.
 *
 * @param {object} cfg
 *   dropZoneId    - id of the upload area element
 *   fileInputId   - id of the <input type="file">
 *   gridId        - id of the photo-grid div
 *   countInfoId   - id of the count info div
 *   stateIds      - { fileIds: key, previews: key } on state object
 *   apiEndpoint   - '/api/images/upload' | '/api/invitation/upload' etc.
 *   formFieldName - field name for FormData (e.g. 'photos', 'signature', 'newspaper')
 *   maxFiles      - maximum number of files allowed
 *   slotPrefix    - e.g. 'PHOTO' → labels as {{PHOTO_1}}
 */
function initMultiImageZone(cfg) {
  const dropZone  = $(cfg.dropZoneId);
  const fileInput = $(cfg.fileInputId);
  if (!dropZone || !fileInput) return;

  dropZone.addEventListener('dragover',  (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleMultiImageFiles(Array.from(e.dataTransfer.files), cfg);
  });
  fileInput.addEventListener('change', () => {
    handleMultiImageFiles(Array.from(fileInput.files), cfg);
    fileInput.value = '';
  });
}

async function handleMultiImageFiles(files, cfg) {
  const imageFiles = files.filter((f) => f.type.match(/^image\/(jpeg|jpg|png|webp)$/i));
  if (imageFiles.length === 0) {
    showToast('Please select JPG, PNG, or WebP images.', 'warning');
    return;
  }

  const fileIds   = state[cfg.stateIds.fileIds];
  const previews  = state[cfg.stateIds.previews];
  const remaining = cfg.maxFiles - fileIds.length;
  if (remaining <= 0) {
    showToast(`Maximum ${cfg.maxFiles} images allowed for this section.`, 'warning');
    return;
  }

  const toUpload = imageFiles.slice(0, remaining);

  setStatus(`Uploading ${toUpload.length} image(s)...`, 'loading');
  try {
    const formData = new FormData();
    toUpload.forEach((f) => formData.append(cfg.formFieldName, f));

    const data = await fetch(cfg.apiEndpoint, { method: 'POST', body: formData })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.message || 'Upload failed');
        return json;
      });

    data.files.forEach((fileInfo, i) => {
      const objectUrl = URL.createObjectURL(toUpload[i]);
      fileIds.push(fileInfo.fileId);
      previews.push({ fileId: fileInfo.fileId, objectUrl, name: fileInfo.originalName });
    });

    renderImageGrid(cfg);
    setStatus('Images uploaded', 'ready');
    updateSummary();
  } catch (err) {
    setStatus('Upload failed', 'error');
    showToast(`Upload error: ${err.message}`, 'error');
  }
}

function renderImageGrid(cfg) {
  const grid     = $(cfg.gridId);
  const countEl  = $(cfg.countInfoId);
  const fileIds  = state[cfg.stateIds.fileIds];
  const previews = state[cfg.stateIds.previews];
  if (!grid) return;

  grid.innerHTML = '';
  previews.forEach((img, idx) => {
    const card = document.createElement('div');
    card.className = 'photo-card';
    card.draggable = true;
    card.dataset.idx = idx;
    card.innerHTML = `
      <img src="${img.objectUrl}" alt="${cfg.slotPrefix} ${idx + 1}" loading="lazy" />
      <div class="photo-card-overlay">
        <span class="photo-slot-label">{{${cfg.slotPrefix}_${idx + 1}}}</span>
        <button class="icon-btn" data-idx="${idx}" aria-label="Remove">✕</button>
      </div>
    `;

    card.querySelector('.icon-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      removeImageFromGrid(idx, cfg);
    });

    // Drag-reorder
    card.addEventListener('dragstart', (e) => {
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', String(idx));
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    card.addEventListener('dragover', (e) => e.preventDefault());
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
      if (fromIdx !== idx) reorderImageGrid(fromIdx, idx, cfg);
    });

    grid.appendChild(card);
  });

  if (countEl) {
    if (previews.length > 0) {
      countEl.classList.remove('hidden');
      countEl.textContent = `${previews.length} image(s) — drag to reorder`;
    } else {
      countEl.classList.add('hidden');
    }
  }
}

function removeImageFromGrid(idx, cfg) {
  const previews = state[cfg.stateIds.previews];
  URL.revokeObjectURL(previews[idx].objectUrl);
  state[cfg.stateIds.fileIds].splice(idx, 1);
  previews.splice(idx, 1);
  renderImageGrid(cfg);
  updateSummary();
}

function reorderImageGrid(fromIdx, toIdx, cfg) {
  const ids  = state[cfg.stateIds.fileIds];
  const prev = state[cfg.stateIds.previews];
  const [idMoved]   = ids.splice(fromIdx, 1);
  const [prevMoved] = prev.splice(fromIdx, 1);
  ids.splice(toIdx, 0, idMoved);
  prev.splice(toIdx, 0, prevMoved);
  renderImageGrid(cfg);
}

// Zone configs
const PHOTO_CFG = {
  dropZoneId: 'photo-drop-zone', fileInputId: 'photo-file-input',
  gridId: 'photo-grid', countInfoId: 'photo-count-info',
  stateIds: { fileIds: 'photoFileIds', previews: 'photoLocalPreviews' },
  apiEndpoint: '/api/images/upload', formFieldName: 'photos',
  maxFiles: 20, slotPrefix: 'PHOTO',
};
const INVITATION_CFG = {
  dropZoneId: 'invitation-drop-zone', fileInputId: 'invitation-file-input',
  gridId: 'invitation-grid', countInfoId: 'invitation-count-info',
  stateIds: { fileIds: 'invitationFileIds', previews: 'invitationLocalPreviews' },
  apiEndpoint: '/api/invitation/upload', formFieldName: 'invitation',
  maxFiles: 10, slotPrefix: 'INVITATION',
};
const SIGNATURE_CFG = {
  dropZoneId: 'signature-drop-zone', fileInputId: 'signature-file-input',
  gridId: 'signature-grid', countInfoId: 'signature-count-info',
  stateIds: { fileIds: 'signatureFileIds', previews: 'signatureLocalPreviews' },
  apiEndpoint: '/api/signature/upload', formFieldName: 'signature',
  maxFiles: 10, slotPrefix: 'SIGNATURE',
};
const NEWSPAPER_CFG = {
  dropZoneId: 'newspaper-drop-zone', fileInputId: 'newspaper-file-input',
  gridId: 'newspaper-grid', countInfoId: 'newspaper-count-info',
  stateIds: { fileIds: 'newspaperFileIds', previews: 'newspaperLocalPreviews' },
  apiEndpoint: '/api/newspaper/upload', formFieldName: 'newspaper',
  maxFiles: 10, slotPrefix: 'NEWSPAPER',
};

// ════════════════════════════════════════════════════════════
// DYNAMIC LISTS – Objectives & Outcomes
// ════════════════════════════════════════════════════════════

function initDynamicLists() {
  $('add-objective-btn').addEventListener('click', () => addListItem('objectives'));
  $('add-outcome-btn').addEventListener('click',   () => addListItem('outcomes'));
}

function addListItem(listType) {
  const listId  = listType === 'objectives' ? 'objectives-list' : 'outcomes-list';
  const emptyId = listType === 'objectives' ? 'objectives-empty' : 'outcomes-empty';
  const list  = $(listId);
  const empty = $(emptyId);
  if (empty) empty.style.display = 'none';

  const arr   = listType === 'objectives' ? state.objectives : state.outcomes;
  const index = arr.length;
  arr.push('');

  const item = document.createElement('div');
  item.className = 'list-item';
  item.dataset.index = index;
  item.innerHTML = `
    <span class="list-item-num">${index + 1}</span>
    <input type="text" placeholder="Enter ${listType === 'objectives' ? 'objective' : 'outcome'}..." />
    <button class="icon-btn" title="Remove" aria-label="Remove item">✕</button>
  `;

  const input = item.querySelector('input');
  input.addEventListener('input', () => { arr[index] = input.value; updateSummary(); });
  item.querySelector('.icon-btn').addEventListener('click', () => {
    arr.splice(index, 1);
    item.remove();
    renumberList(listId, listType);
    if (arr.length === 0 && empty) empty.style.display = '';
    updateSummary();
  });

  list.appendChild(item);
  input.focus();
  updateSummary();
}

function renumberList(listId, listType) {
  const items = $(listId).querySelectorAll('.list-item');
  const arr   = listType === 'objectives' ? state.objectives : state.outcomes;
  items.forEach((item, i) => {
    item.dataset.index = i;
    item.querySelector('.list-item-num').textContent = i + 1;
    const input = item.querySelector('input');
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    newInput.addEventListener('input', () => { arr[i] = newInput.value; updateSummary(); });
  });
}

// ════════════════════════════════════════════════════════════
// QUILL RICH TEXT EDITOR
// ════════════════════════════════════════════════════════════

function initQuill() {
  state.quillEditor = new Quill('#report-editor', {
    theme: 'snow',
    placeholder: 'Describe the event: date, activities, speakers, participants, highlights...',
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['clean'],
      ],
    },
  });
  state.quillEditor.on('text-change', () => updateSummary());
}

// ════════════════════════════════════════════════════════════
// CUSTOM PLACEHOLDER MAPPING
// ════════════════════════════════════════════════════════════

const HANDLED_PLACEHOLDERS = new Set([
  'EVENT_TITLE', 'REPORT_TITLE', 'REPORT', 'REPORT_DESCRIPTION',
  'OBJECTIVES', 'OUTCOME',
  // Photo families
  ...Array.from({length: 20}, (_, i) => `PHOTO_${i+1}`),
  ...Array.from({length: 10}, (_, i) => `INVITATION_${i+1}`),
  ...Array.from({length: 10}, (_, i) => `SIGNATURE_${i+1}`),
  ...Array.from({length: 10}, (_, i) => `NEWSPAPER_${i+1}`),
  'SIGNATURE', 'NEWSPAPER_CLIPPING', 'NEWSPAPER',
  'PAGE_BREAK', 'PHOTO_SECTION', 'SECTION_BREAK',
]);

function updateCustomMappingSection(placeholders) {
  const container = $('custom-mapping-list');
  const unhandled = placeholders.filter((p) => !HANDLED_PLACEHOLDERS.has(p.name) && p.type === 'text');

  if (unhandled.length === 0) {
    container.innerHTML = `<p class="text-muted">All detected placeholders are handled by the form fields above.</p>`;
    return;
  }

  container.innerHTML = unhandled.map((p) => `
    <div class="mapping-row">
      <span class="mapping-token">${p.token}</span>
      <span class="mapping-arrow">→</span>
      <input class="mapping-input" type="text" id="map-${p.name}" data-placeholder="${p.name}" placeholder="Enter value for ${p.token}..." />
    </div>
  `).join('');
}

function getCustomMappingData() {
  const result = {};
  document.querySelectorAll('.mapping-input').forEach((input) => {
    if (input.value.trim()) result[input.dataset.placeholder] = input.value.trim();
  });
  return result;
}

// ════════════════════════════════════════════════════════════
// CONTENT SUMMARY
// ════════════════════════════════════════════════════════════

function updateSummary() {
  const placeholder = $('preview-placeholder');
  const summary     = $('content-summary');
  const list        = $('summary-list');

  const eventTitle  = $('field-event-title')?.value?.trim();
  const hasTemplate = !!state.templateId;

  if (!hasTemplate && !eventTitle) {
    placeholder.classList.remove('hidden');
    summary.classList.add('hidden');
    return;
  }

  placeholder.classList.add('hidden');
  summary.classList.remove('hidden');

  const items = [];

  items.push({
    icon: '📄', label: 'Template',
    value: hasTemplate ? state.templateFilename : 'Not uploaded',
    good: hasTemplate, warn: !hasTemplate,
  });

  if (eventTitle) items.push({ icon: '📌', label: 'Event Title', value: eventTitle, good: true });

  const reportTitle = $('field-report-title')?.value?.trim();
  if (reportTitle) items.push({ icon: '📝', label: 'Report Title', value: reportTitle, good: true });

  if (state.invitationLocalPreviews.length > 0) {
    items.push({ icon: '📩', label: 'Invitation', value: `${state.invitationLocalPreviews.length} image(s)`, good: true });
  }
  if (state.objectives.filter(Boolean).length > 0) {
    items.push({ icon: '🎯', label: 'Objectives', value: `${state.objectives.filter(Boolean).length} item(s)`, good: true });
  }
  const reportText = state.quillEditor ? state.quillEditor.getText().trim() : '';
  if (reportText.length > 10) {
    items.push({ icon: '📖', label: 'Report', value: `${reportText.length} characters`, good: true });
  }
  if (state.outcomes.filter(Boolean).length > 0) {
    items.push({ icon: '✅', label: 'Outcome', value: `${state.outcomes.filter(Boolean).length} item(s)`, good: true });
  }
  if (state.photoLocalPreviews.length > 0) {
    items.push({ icon: '📷', label: 'Photos', value: `${state.photoLocalPreviews.length} photo(s)`, good: true });
  }
  if (state.signatureLocalPreviews.length > 0) {
    items.push({ icon: '✍️', label: 'Signatures', value: `${state.signatureLocalPreviews.length} image(s)`, good: true });
  }
  if (state.newspaperLocalPreviews.length > 0) {
    items.push({ icon: '📰', label: 'Newspaper', value: `${state.newspaperLocalPreviews.length} clipping(s)`, good: true });
  }

  list.innerHTML = items.map((item) => `
    <li class="summary-item">
      <span class="summary-item-icon">${item.icon}</span>
      <span class="summary-item-label">${item.label}</span>
      <span class="summary-item-value ${item.good ? 'good' : item.warn ? 'warn' : ''}">${item.value}</span>
    </li>
  `).join('');
}

// ════════════════════════════════════════════════════════════
// GENERATE DOCUMENT
// ════════════════════════════════════════════════════════════

function initGenerateBtn() {
  $('generate-btn').addEventListener('click', handleGenerate);
  $('generate-another-btn').addEventListener('click', resetGenerationState);
}

async function handleGenerate() {
  if (!state.templateId) {
    showToast('Please upload a Word template first.', 'warning');
    $('section-template').scrollIntoView({ behavior: 'smooth' });
    return;
  }

  const eventTitle = $('field-event-title').value.trim();
  if (!eventTitle) {
    showToast('Please enter an Event Title.', 'warning');
    $('field-event-title').focus();
    return;
  }

  showProgressPanel();
  $('generate-btn').disabled = true;
  setStatus('Generating document...', 'loading');

  const progressSteps = ['template', 'text', 'invitation', 'images', 'signature', 'newspaper', 'formatting', 'docx'];
  let stepIdx = 0;
  markProgressStep(progressSteps[0], 'active');

  const stepInterval = setInterval(() => {
    if (stepIdx < progressSteps.length) {
      markProgressStep(progressSteps[stepIdx], 'done');
      stepIdx++;
      if (stepIdx < progressSteps.length) markProgressStep(progressSteps[stepIdx], 'active');
    }
  }, 700);

  try {
    const reportHtml = state.quillEditor ? state.quillEditor.root.innerHTML : '';

    const payload = {
      templateId: state.templateId,
      eventTitle,
      reportTitle: $('field-report-title').value.trim(),
      objectives: state.objectives.filter(Boolean),
      reportDescription: reportHtml,
      outcomes: state.outcomes.filter(Boolean),
      photoFileIds:       state.photoFileIds,
      invitationFileIds:  state.invitationFileIds,
      signatureFileIds:   state.signatureFileIds,
      newspaperFileIds:   state.newspaperFileIds,
      customTextData: getCustomMappingData(),
    };

    const data = await fetch('/api/document/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(async (r) => {
      const json = await r.json();
      if (!r.ok) throw new Error(json.message || json.messages?.join('\n') || 'Generation failed');
      return json;
    });

    clearInterval(stepInterval);
    progressSteps.forEach((s) => markProgressStep(s, 'done'));

    await new Promise((resolve) => setTimeout(resolve, 600));

    state.jobId = data.jobId;
    state.docxFilename = data.filename;

    showDownloadPanel(data);
    setStatus('Document ready', 'ready');
    showToast('Document generated successfully!', 'success');
  } catch (err) {
    clearInterval(stepInterval);
    hideProgressPanel();
    $('generate-btn').disabled = false;
    setStatus('Generation failed', 'error');
    showToast(`Generation error: ${err.message}`, 'error', 8000);
    console.error('[GENERATE]', err);
  }
}

function markProgressStep(stepName, status) {
  const el = document.querySelector(`.progress-step[data-step="${stepName}"]`);
  if (el) el.className = `progress-step ${status}`;
}

function showProgressPanel() {
  $('preview-placeholder').classList.add('hidden');
  $('content-summary').classList.add('hidden');
  $('download-panel').classList.add('hidden');
  $('progress-panel').classList.remove('hidden');
  document.querySelectorAll('.progress-step').forEach((el) => { el.className = 'progress-step'; });
}

function hideProgressPanel() {
  $('progress-panel').classList.add('hidden');
  updateSummary();
}

function showDownloadPanel(data) {
  $('progress-panel').classList.add('hidden');
  $('download-panel').classList.remove('hidden');
  $('download-filename').textContent = data.filename;
  $('docx-download-btn').href = data.docxUrl;
  $('docx-download-btn').download = data.filename;

  const pdfBtn = $('pdf-download-btn');
  if (data.pdfUrl) {
    pdfBtn.href = data.pdfUrl;
    pdfBtn.download = data.pdfFilename || data.filename.replace('.docx', '.pdf');
    pdfBtn.style.display = 'inline-flex';
  } else {
    pdfBtn.style.display = 'none';
  }
}

function resetGenerationState() {
  $('download-panel').classList.add('hidden');
  $('generate-btn').disabled = false;
  state.jobId = null;
  state.docxFilename = null;
  document.querySelectorAll('.progress-step').forEach((el) => { el.className = 'progress-step'; });
  updateSummary();
  setStatus('Ready', 'ready');
}

// ════════════════════════════════════════════════════════════
// FIELD LISTENERS (for summary updates)
// ════════════════════════════════════════════════════════════

function initFieldListeners() {
  ['field-event-title', 'field-report-title'].forEach((id) => {
    const el = $(id);
    if (el) el.addEventListener('input', updateSummary);
  });
}

// ════════════════════════════════════════════════════════════
// INITIALIZATION
// ════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  initTemplateUpload();
  initDynamicLists();
  initQuill();

  // Register all multi-image zones
  initMultiImageZone(PHOTO_CFG);
  initMultiImageZone(INVITATION_CFG);
  initMultiImageZone(SIGNATURE_CFG);
  initMultiImageZone(NEWSPAPER_CFG);

  initGenerateBtn();
  initFieldListeners();
  updateSummary();

  console.log('🚀 Document Automation App initialized');
});
