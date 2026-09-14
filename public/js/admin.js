'use strict';

// ─── Utilities ───
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

// ─── Auth Check ───
const token = localStorage.getItem('adminToken');
if (!token) {
  window.location.href = '/admin-login.html';
}

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

// ─── App State ───
let currentTemplateId = null;

// ─── DOM Events ───
document.addEventListener('DOMContentLoaded', () => {
  loadTemplates();

  $('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('adminToken');
    window.location.href = '/admin-login.html';
  });

  $('create-template-btn').addEventListener('click', () => {
    openTemplateForm();
  });

  $('cancel-form-btn').addEventListener('click', () => {
    $('content-template-form').classList.add('hidden');
    $('content-templates').classList.remove('hidden');
  });

  $('add-step-btn').addEventListener('click', addStep);
  $('save-template-btn').addEventListener('click', saveTemplate);
});

// ─── API Calls ───
async function loadTemplates() {
  try {
    const res = await fetch('/api/admin/templates', { headers: getHeaders() });
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('adminToken');
      window.location.href = '/admin-login.html';
      return;
    }
    const data = await res.json();
    renderTemplates(data);
  } catch (err) {
    showToast('Failed to load templates', 'error');
  }
}

function renderTemplates(templates) {
  const grid = $('templates-grid');
  if (templates.length === 0) {
    grid.innerHTML = '<p class="text-muted">No templates configured yet. Click "Create Template" to begin.</p>';
    return;
  }

  grid.innerHTML = templates.map(t => `
    <div class="template-card">
      <h3 class="template-card-title">${t.templateName}</h3>
      <p class="template-card-desc">${t.description || 'No description provided.'}</p>
      <div class="text-muted" style="font-size:0.8rem; margin-bottom: 15px;">Steps: ${t.steps.length}</div>
      <div class="template-card-actions">
        <button class="btn btn-outline btn-sm edit-btn" data-id="${t._id}">Edit</button>
        <button class="btn btn-outline btn-sm delete-btn" data-id="${t._id}" style="color: #e74c3c; border-color: #fadbd8;">Delete</button>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => loadTemplateForEdit(btn.dataset.id));
  });

  grid.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteTemplate(btn.dataset.id));
  });
}

async function loadTemplateForEdit(id) {
  try {
    const res = await fetch(`/api/admin/templates/${id}`, { headers: getHeaders() });
    const data = await res.json();
    openTemplateForm(data);
  } catch (err) {
    showToast('Failed to load template', 'error');
  }
}

async function deleteTemplate(id) {
  if (!confirm('Are you sure you want to delete this template configuration?')) return;
  try {
    await fetch(`/api/admin/templates/${id}`, { method: 'DELETE', headers: getHeaders() });
    showToast('Template deleted', 'success');
    loadTemplates();
  } catch (err) {
    showToast('Failed to delete', 'error');
  }
}

// ─── Form Builder Logic ───
function openTemplateForm(data = null) {
  $('content-templates').classList.add('hidden');
  $('content-template-form').classList.remove('hidden');
  $('steps-container').innerHTML = '';
  $('cfg-template-file').value = '';

  if (data) {
    currentTemplateId = data._id;
    $('form-title').textContent = 'Edit Template Configuration';
    $('cfg-template-name').value = data.templateName;
    $('cfg-template-desc').value = data.description || '';
    
    if (data.templateFilename) {
      $('cfg-current-file-info').textContent = `Current file: ${data.templateFilename}`;
      $('cfg-current-file-info').classList.remove('hidden');
    } else {
      $('cfg-current-file-info').classList.add('hidden');
    }

    data.steps.forEach(step => addStep(step));
  } else {
    currentTemplateId = null;
    $('form-title').textContent = 'Create New Template';
    $('cfg-template-name').value = '';
    $('cfg-template-desc').value = '';
    $('cfg-current-file-info').classList.add('hidden');
    addStep(); // Add default empty step
  }
}

function addStep(data = null) {
  const container = $('steps-container');
  const template = $('tpl-step').content.cloneNode(true);
  const stepCard = template.querySelector('.step-card');
  
  if (data) {
    stepCard.querySelector('.step-title-input').value = data.title || '';
    stepCard.querySelector('.step-desc-input').value = data.description || '';
  }

  // Bind Events
  stepCard.querySelector('.remove-step-btn').addEventListener('click', (e) => {
    e.target.closest('.step-card').remove();
    updateStepNumbers();
  });

  const fieldsContainer = stepCard.querySelector('.fields-container');
  stepCard.querySelector('.add-field-btn').addEventListener('click', () => {
    addField(fieldsContainer);
  });

  if (data && data.fields) {
    data.fields.forEach(f => addField(fieldsContainer, f));
  } else {
    addField(fieldsContainer); // Add default field
  }

  container.appendChild(stepCard);
  updateStepNumbers();
}

function updateStepNumbers() {
  const steps = $('steps-container').querySelectorAll('.step-card');
  steps.forEach((step, idx) => {
    step.dataset.stepIndex = idx;
    step.querySelector('.step-number-display').textContent = idx + 1;
  });
}

function addField(container, data = null) {
  const template = $('tpl-field').content.cloneNode(true);
  const fieldRow = template.querySelector('.field-row');

  if (data) {
    fieldRow.querySelector('.field-label-input').value = data.label || '';
    fieldRow.querySelector('.field-type-select').value = data.type || 'text';
    fieldRow.querySelector('.field-map-input').value = data.placeholderMap || '';
  }

  fieldRow.querySelector('.remove-field-btn').addEventListener('click', (e) => {
    e.target.closest('.field-row').remove();
  });

  container.appendChild(fieldRow);
}

// ─── Save Logic ───
async function saveTemplate() {
  const templateName = $('cfg-template-name').value.trim();
  const description = $('cfg-template-desc').value.trim();

  if (!templateName) {
    showToast('Template Name is required', 'warning');
    return;
  }

  // Gather steps
  const steps = [];
  const stepCards = $('steps-container').querySelectorAll('.step-card');
  
  for (let i = 0; i < stepCards.length; i++) {
    const card = stepCards[i];
    const title = card.querySelector('.step-title-input').value.trim();
    if (!title) {
      showToast(`Step ${i + 1} is missing a title`, 'warning');
      return;
    }

    const fields = [];
    const fieldRows = card.querySelectorAll('.field-row');
    for (let j = 0; j < fieldRows.length; j++) {
      const row = fieldRows[j];
      const label = row.querySelector('.field-label-input').value.trim();
      const type = row.querySelector('.field-type-select').value;
      const placeholderMap = row.querySelector('.field-map-input').value.trim();

      if (!label || !placeholderMap) {
        showToast(`Field in Step ${i + 1} is incomplete`, 'warning');
        return;
      }

      fields.push({ label, type, placeholderMap });
    }

    steps.push({
      stepNumber: i + 1,
      title,
      description: card.querySelector('.step-desc-input').value.trim(),
      fields
    });
  }

  const payload = { templateName, description, steps };

  const formData = new FormData();
  formData.append('config', JSON.stringify(payload));

  const fileInput = $('cfg-template-file');
  if (fileInput.files.length > 0) {
    formData.append('templateFile', fileInput.files[0]);
  } else if (!currentTemplateId) {
    showToast('Please upload a template document.', 'warning');
    return;
  }

  try {
    const url = currentTemplateId ? `/api/admin/templates/${currentTemplateId}` : '/api/admin/templates';
    const method = currentTemplateId ? 'PUT' : 'POST';

    // Must not set Content-Type header manually for FormData, browser sets it with boundary
    const headers = { 'Authorization': `Bearer ${token}` };

    const res = await fetch(url, {
      method,
      headers,
      body: formData
    });

    const data = await res.json();
    if (res.ok) {
      showToast('Configuration saved successfully!', 'success');
      $('content-template-form').classList.add('hidden');
      $('content-templates').classList.remove('hidden');
      loadTemplates();
    } else {
      showToast(data.message || 'Error saving configuration', 'error');
    }
  } catch (err) {
    showToast('Server error during save', 'error');
  }
}
