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

  // Navigation
  $('menu-templates').addEventListener('click', () => {
    $('menu-templates').classList.add('active');
    $('menu-reports').classList.remove('active');
    if($('menu-edit-table')) $('menu-edit-table').classList.remove('active');
    if($('menu-certificates')) $('menu-certificates').classList.remove('active');
    $('content-templates').classList.remove('hidden');
    $('content-reports').classList.add('hidden');
    $('content-template-form').classList.add('hidden');
    if($('content-edit-table')) $('content-edit-table').classList.add('hidden');
    if($('content-certificates')) $('content-certificates').classList.add('hidden');
    loadTemplates();
  });

  $('menu-reports').addEventListener('click', async () => {
    $('menu-reports').classList.add('active');
    $('menu-templates').classList.remove('active');
    if($('menu-edit-table')) $('menu-edit-table').classList.remove('active');
    if($('menu-certificates')) $('menu-certificates').classList.remove('active');
    $('content-reports').classList.remove('hidden');
    $('content-templates').classList.add('hidden');
    $('content-template-form').classList.add('hidden');
    if($('content-edit-table')) $('content-edit-table').classList.add('hidden');
    if($('content-certificates')) $('content-certificates').classList.add('hidden');
    await loadColumns();
    loadReports();
  });

  if($('menu-edit-table')) {
    $('menu-edit-table').addEventListener('click', async () => {
      $('menu-edit-table').classList.add('active');
      $('menu-reports').classList.remove('active');
      $('menu-templates').classList.remove('active');
      if($('menu-certificates')) $('menu-certificates').classList.remove('active');
      if($('content-edit-table')) $('content-edit-table').classList.remove('hidden');
      $('content-reports').classList.add('hidden');
      $('content-templates').classList.add('hidden');
      $('content-template-form').classList.add('hidden');
      if($('content-certificates')) $('content-certificates').classList.add('hidden');
      await loadColumns();
      renderColumns();
    });
  }

  if($('menu-certificates')) {
    $('menu-certificates').addEventListener('click', () => {
      $('menu-certificates').classList.add('active');
      $('menu-templates').classList.remove('active');
      $('menu-reports').classList.remove('active');
      if($('menu-edit-table')) $('menu-edit-table').classList.remove('active');
      if($('content-certificates')) $('content-certificates').classList.remove('hidden');
      $('content-templates').classList.add('hidden');
      $('content-reports').classList.add('hidden');
      $('content-template-form').classList.add('hidden');
      if($('content-edit-table')) $('content-edit-table').classList.add('hidden');
    });
  }

  initCertificateGenerator();

  // Reports Events
  $('add-report-btn').addEventListener('click', () => {
      currentEditingReportId = null;
      currentColumns.forEach(col => {
        const el = $( 'report-field-' + col.key );
        if(el) {
          if(col.inputType === 'select') {
            const opts = (col.options || '').split(',');
            el.value = opts.length ? opts[0].trim() : '';
          } else {
            el.value = '';
          }
        }
      });
      $('add-report-modal').querySelector('h2').textContent = 'Add Report';
      $('add-report-modal').classList.remove('hidden');
    });

  $('cancel-report-btn').addEventListener('click', () => {
    $('add-report-modal').classList.add('hidden');
    currentEditingReportId = null;
  });

  $('save-report-btn').addEventListener('click', saveReport);

  $('import-report-btn').addEventListener('click', () => {
    $('import-excel-file').click();
  });

  $('import-excel-file').addEventListener('change', importReport);

  $('export-report-btn').addEventListener('click', exportReports);

  // Search Filter Events
  $('report-search-text').addEventListener('input', filterReports);
  $('report-search-col').addEventListener('change', filterReports);
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

// ─── Reports API Logic ───

let currentColumns = [];
let currentEditingColumnId = null;

async function loadColumns() {
  try {
    const res = await fetch('/api/report-column', { headers: getHeaders() });
    currentColumns = await res.json();
    updateTableHeaders();
  } catch (err) {
    showToast('Failed to load columns', 'error');
  }
}

function updateTableHeaders() {
  const searchSelect = $('report-search-col');
  if(searchSelect) {
    const currentSearch = searchSelect.value;
    searchSelect.innerHTML = currentColumns.map(c => `<option value="${c.key}">${c.label}</option>`).join('');
    if(currentColumns.find(c => c.key === currentSearch)) searchSelect.value = currentSearch;
  }

  const table = $('reports-table');
  if(table) {
    const thead = table.querySelector('thead tr');
    thead.innerHTML = currentColumns.map(c => `<th style="padding: 12px;">${c.label}</th>`).join('') + '<th style="padding: 12px;">Actions</th>';
  }

  const dynamicFields = $('dynamic-report-fields');
  if(dynamicFields) {
    dynamicFields.innerHTML = currentColumns.map(c => {
      if(c.inputType === 'select') {
        const options = (c.options || '').split(',').map(o => o.trim()).filter(o => o);
        const optionsHtml = options.map(o => `<option value="${o}">${o}</option>`).join('');
        return `<div class="form-group" style="margin-bottom: 15px;">
          <label class="form-label">${c.label}</label>
          <select id="report-field-${c.key}" class="form-input">
            ${optionsHtml}
          </select>
        </div>`;
      }
      return `<div class="form-group" style="margin-bottom: 15px;">
        <label class="form-label">${c.label}</label>
        <input type="text" id="report-field-${c.key}" class="form-input" />
      </div>`;
    }).join('');
  }
}

let currentReports = [];
let currentEditingReportId = null;

async function loadReports() {
  try {
    const res = await fetch('/api/report');
    const data = await res.json();
    currentReports = data;
    filterReports(); // Automatically renders with current search if any
  } catch (err) {
    showToast('Failed to load reports', 'error');
  }
}

function filterReports() {
  const searchText = $('report-search-text').value.toLowerCase();
  const searchCol = $('report-search-col').value;

  if (!searchText) {
    renderReports(currentReports);
    return;
  }

  const filtered = currentReports.filter(r => {
    const val = r[searchCol];
    return val && val.toString().toLowerCase().includes(searchText);
  });

  renderReports(filtered);
}

function renderReports(reports) {
  const tbody = $('reports-table-body');
  if (reports.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="padding: 12px; text-align: center;">No reports found.</td></tr>';
    return;
  }

  tbody.innerHTML = reports.map(r => `
    <tr style="border-bottom: 1px solid #eee;">
      ${currentColumns.map(c => {
        if(c.inputType === 'select') {
          return `<td style="padding: 12px;">
            <span style="padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; background: #e2e8f0; color: #1e293b;">
              ${r[c.key] || 'N/A'}
            </span>
          </td>`;
        }
        return `<td style="padding: 12px;">${r[c.key] || 'N/A'}</td>`;
      }).join('')}
      <td style="padding: 12px;">
        <div style="display: flex; gap: 10px; align-items: center;">
          <button class="icon-btn edit-report-btn" data-id="${r._id}" title="Edit">✏️</button>
          <button class="icon-btn delete-report-btn" data-id="${r._id}" title="Delete">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');

  // Attach event listeners for edit and delete
  document.querySelectorAll('.edit-report-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      openEditReport(id);
    });
  });

  document.querySelectorAll('.delete-report-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      deleteReportAction(id);
    });
  });
}

function openEditReport(id) {
    const report = currentReports.find(r => r._id === id);
    if (!report) return;

    currentEditingReportId = id;
    currentColumns.forEach(col => {
      const el = $( 'report-field-' + col.key );
      if(el) {
        el.value = report[col.key] || (col.inputType === 'select' ? ((col.options||'').split(',')[0]||'').trim() : '');
      }
    });
    $('add-report-modal').querySelector('h2').textContent = 'Edit Report';
    $('add-report-modal').classList.remove('hidden');
  }

async function deleteReportAction(id) {
  if (!confirm('Are you sure you want to delete this report?')) return;

  try {
    const res = await fetch(`/api/report/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    if (res.ok) {
      showToast('Report deleted successfully', 'success');
      loadReports();
    } else {
      showToast('Failed to delete report', 'error');
    }
  } catch (err) {
    showToast('Server error', 'error');
  }
}

async function saveReport() {
  const payload = {};
  for(let col of currentColumns) {
    const el = $('report-field-' + col.key);
    if(el) payload[col.key] = el.value.trim();
  }

  try {
    const url = currentEditingReportId ? `/api/report/${currentEditingReportId}` : '/api/report';
    const method = currentEditingReportId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      showToast(currentEditingReportId ? 'Report updated successfully' : 'Report added successfully', 'success');
      $('add-report-modal').classList.add('hidden');
      currentColumns.forEach(col => {
        const el = $( 'report-field-' + col.key );
        if(el) el.value = col.inputType === 'select' ? ((col.options||'').split(',')[0]||'').trim() : '';
      });
      currentEditingReportId = null;
      loadReports();
    } else {
      showToast(currentEditingReportId ? 'Failed to update report' : 'Failed to add report', 'error');
    }
  } catch (err) {
    showToast('Server error', 'error');
  }
}

async function importReport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/report/import', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Successfully imported ${data.count} reports`, 'success');
      loadReports();
    } else {
      showToast(data.message || 'Failed to import', 'error');
    }
  } catch (err) {
    showToast('Server error during import', 'error');
  }
  
  event.target.value = ''; // Reset file input
}

function exportReports() {
  if (currentReports.length === 0) {
    showToast('No data to export', 'warning');
    return;
  }

  const csvRows = [];
  const headers = currentColumns.map(c => c.label).concat(['Date Created']);
  csvRows.push(headers.join(','));

  currentReports.forEach(r => {
    const row = currentColumns.map(c => `"${(r[c.key] || '').toString().replace(/"/g, '""')}"`);
    row.push(`"${new Date(r.createdAt).toLocaleDateString()}"`);
    csvRows.push(row.join(','));
  });

  const csvData = csvRows.join('\n');
  const blob = new Blob([csvData], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.setAttribute('hidden', '');
  a.setAttribute('href', url);
  a.setAttribute('download', 'reports.csv');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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


// ─── Columns Management Logic ───
document.addEventListener('DOMContentLoaded', () => {
  $('add-column-btn')?.addEventListener('click', () => {
    currentEditingColumnId = null;
    $('column-label').value = '';
    $('column-key').value = '';
    $('column-key').disabled = false;
    $('column-order').value = (currentColumns.length + 1) * 10;
    
    if($('column-input-type')) $('column-input-type').value = 'text';
    if($('column-options')) $('column-options').value = '';
    if($('column-options-group')) $('column-options-group').style.display = 'none';
    
    $('column-modal-title').textContent = 'Add Column';
    $('add-column-modal').classList.remove('hidden');
  });

  $('column-input-type')?.addEventListener('change', (e) => {
    if(e.target.value === 'select') {
      $('column-options-group').style.display = 'block';
    } else {
      $('column-options-group').style.display = 'none';
    }
  });

  $('cancel-column-btn')?.addEventListener('click', () => {
    $('add-column-modal').classList.add('hidden');
  });

  $('save-column-btn')?.addEventListener('click', saveColumn);
});

function renderColumns() {
  const tbody = $('columns-table-body');
  if(!tbody) return;
  tbody.innerHTML = currentColumns.map(c => `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 12px;">${c.label}</td>
      <td style="padding: 12px;">${c.key}</td>
      <td style="padding: 12px;">${c.order}</td>
      <td style="padding: 12px;">
        <div style="display: flex; gap: 10px; align-items: center;">
          <button class="icon-btn edit-column-btn" data-id="${c._id}" title="Edit">✏️</button>
          <button class="icon-btn delete-column-btn" data-id="${c._id}" title="Delete">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');

  document.querySelectorAll('.edit-column-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const col = currentColumns.find(c => c._id === id);
      if(col) {
        currentEditingColumnId = id;
        $('column-label').value = col.label;
        $('column-key').value = col.key;
        $('column-key').disabled = true; // Key shouldn't be edited easily
        $('column-order').value = col.order;
        
        if($('column-input-type')) $('column-input-type').value = col.inputType || 'text';
        if($('column-options')) $('column-options').value = col.options || '';
        if($('column-options-group')) $('column-options-group').style.display = (col.inputType === 'select') ? 'block' : 'none';

        $('column-modal-title').textContent = 'Edit Column';
        $('add-column-modal').classList.remove('hidden');
      }
    });
  });

  document.querySelectorAll('.delete-column-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      if(confirm('Are you sure you want to delete this column?')) {
        try {
          const res = await fetch(`/api/report-column/${id}`, { method: 'DELETE', headers: getHeaders() });
          if(res.ok) {
            showToast('Column deleted', 'success');
            await loadColumns();
            renderColumns();
          } else {
            const errData = await res.json();
            showToast(errData.message || 'Failed to delete column', 'error');
          }
        } catch(err) {
          showToast('Server error', 'error');
        }
      }
    });
  });
}

async function saveColumn() {
  const label = $('column-label').value.trim();
  const key = $('column-key').value.trim();
  const order = parseInt($('column-order').value) || 0;
  const inputType = $('column-input-type') ? $('column-input-type').value : 'text';
  const options = $('column-options') ? $('column-options').value.trim() : '';

  if(!label || !key) {
    showToast('Label and Key are required', 'warning');
    return;
  }
  
  if(inputType === 'select' && !options) {
    showToast('Options are required for dropdown', 'warning');
    return;
  }

  try {
    const url = currentEditingColumnId ? `/api/report-column/${currentEditingColumnId}` : '/api/report-column';
    const method = currentEditingColumnId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: getHeaders(),
      body: JSON.stringify({ label, key, order, inputType, options })
    });
    
    if(res.ok) {
      showToast(currentEditingColumnId ? 'Column updated' : 'Column added', 'success');
      $('add-column-modal').classList.add('hidden');
      await loadColumns();
      renderColumns();
    } else {
      const errData = await res.json();
      showToast(errData.message || 'Error saving column', 'error');
    }
  } catch(err) {
    showToast('Server error', 'error');
  }
}

// ─── Certificate Generator ───
const certState = {
  templateImage: null,
  templateImageSrc: null,
  imageWidth: 0,
  imageHeight: 0,
  excelData: [],
  excelHeaders: [],
  generatedZipBlob: null,
  sampleDataUrl: null,
  sampleName: null,
  selectedCoordY: 500
};

function initCertificateGenerator() {
  const chooseTemplateBtn = $('cert-choose-template-btn');
  const templateInput = $('cert-template-input');
  const templateBox = $('cert-template-box');

  const chooseExcelBtn = $('cert-choose-excel-btn');
  const excelInput = $('cert-excel-input');
  const excelBox = $('cert-excel-box');

  if (chooseTemplateBtn && templateInput) {
    chooseTemplateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      templateInput.click();
    });
    if (templateBox) {
      templateBox.addEventListener('click', () => templateInput.click());
    }
    templateInput.addEventListener('change', handleTemplateFileSelect);
  }

  if (chooseExcelBtn && excelInput) {
    chooseExcelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      excelInput.click();
    });
    if (excelBox) {
      excelBox.addEventListener('click', () => excelInput.click());
    }
    excelInput.addEventListener('change', handleExcelFileSelect);
  }

  // Text size slider
  const sizeSlider = $('cert-font-size');
  const sizeLabel = $('cert-size-label');
  if (sizeSlider && sizeLabel) {
    sizeSlider.addEventListener('input', (e) => {
      sizeLabel.textContent = `Text Size (${e.target.value}px)`;
    });
  }

  // Text color picker
  const colorTrigger = $('cert-color-trigger');
  const colorInput = $('cert-font-color');
  const colorBar = $('cert-color-bar');
  if (colorTrigger && colorInput && colorBar) {
    colorTrigger.addEventListener('click', () => colorInput.click());
    colorInput.addEventListener('input', (e) => {
      colorBar.style.backgroundColor = e.target.value;
    });
  }

  // Coordinates Modal
  const findCoordsBtn = $('cert-find-coords-btn');
  if (findCoordsBtn) findCoordsBtn.addEventListener('click', openCoordsModal);

  const closeCoordsModalBtn = $('close-coords-modal');
  if (closeCoordsModalBtn) closeCoordsModalBtn.addEventListener('click', closeCoordsModal);

  const cancelCoordsBtn = $('cancel-coords-btn');
  if (cancelCoordsBtn) cancelCoordsBtn.addEventListener('click', closeCoordsModal);

  const applyCoordsBtn = $('apply-coords-btn');
  if (applyCoordsBtn) applyCoordsBtn.addEventListener('click', applyCoords);

  // Generate Button
  const genBtn = $('cert-generate-btn');
  if (genBtn) genBtn.addEventListener('click', startBulkCertificateGeneration);

  // Download ZIP Button
  const downloadZipBtn = $('cert-download-zip-btn');
  if (downloadZipBtn) {
    downloadZipBtn.addEventListener('click', () => {
      if (certState.generatedZipBlob) {
        downloadBlob(certState.generatedZipBlob, `Certificates_${Date.now()}.zip`);
      }
    });
  }

  // Preview Sample Modal
  const previewSampleBtn = $('cert-preview-sample-btn');
  if (previewSampleBtn) previewSampleBtn.addEventListener('click', openSamplePreviewModal);

  const closePreviewModalBtn = $('close-preview-modal');
  if (closePreviewModalBtn) {
    closePreviewModalBtn.addEventListener('click', () => $('cert-preview-modal').classList.add('hidden'));
  }

  const closePreviewBtn = $('close-preview-btn');
  if (closePreviewBtn) {
    closePreviewBtn.addEventListener('click', () => $('cert-preview-modal').classList.add('hidden'));
  }
}

function handleTemplateFileSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  $('cert-template-name').textContent = file.name;
  $('cert-template-name').style.color = '#1e293b';

  const reader = new FileReader();
  reader.onload = (evt) => {
    const img = new Image();
    img.onload = () => {
      certState.templateImage = img;
      certState.templateImageSrc = evt.target.result;
      certState.imageWidth = img.naturalWidth;
      certState.imageHeight = img.naturalHeight;

      if (!$('cert-y-pos').value || $('cert-y-pos').value === '500') {
        $('cert-y-pos').value = Math.round(img.naturalHeight * 0.55);
      }
      showToast(`Template loaded (${img.naturalWidth} x ${img.naturalHeight}px)`, 'info');
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}

function handleExcelFileSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  $('cert-excel-name').textContent = file.name;
  $('cert-excel-name').style.color = '#1e293b';

  if (typeof XLSX === 'undefined') {
    showToast('Excel parser library loading, please wait...', 'warning');
    return;
  }

  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      const headerRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      const headers = headerRows[0] || [];

      certState.excelData = json;
      certState.excelHeaders = headers.map(h => String(h).trim()).filter(Boolean);

      renderDetectedColumnPills();
      showToast(`Excel file loaded: ${json.length} rows found`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to parse Excel file', 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

function renderDetectedColumnPills() {
  const container = $('cert-pills-container');
  const wrap = $('cert-detected-cols');
  if (!container || !wrap) return;

  container.innerHTML = '';
  if (!certState.excelHeaders.length) {
    wrap.classList.add('hidden');
    return;
  }

  wrap.classList.remove('hidden');
  const currentVal = $('cert-column-name').value.trim().toLowerCase();
  let hasAutoSelected = false;

  certState.excelHeaders.forEach(col => {
    const pill = document.createElement('span');
    pill.className = 'cert-pill';
    pill.textContent = col;

    const lowerCol = col.toLowerCase();
    if (lowerCol === currentVal || (!hasAutoSelected && (lowerCol === 'name' || lowerCol.includes('name')))) {
      pill.classList.add('active');
      $('cert-column-name').value = col;
      hasAutoSelected = true;
    }

    pill.addEventListener('click', () => {
      $('cert-column-name').value = col;
      container.querySelectorAll('.cert-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
    });

    container.appendChild(pill);
  });
}

function openCoordsModal() {
  if (!certState.templateImage) {
    showToast('Please upload a certificate template image first', 'warning');
    return;
  }

  const modal = $('cert-coords-modal');
  const canvas = $('coords-canvas');
  if (!modal || !canvas) return;

  modal.classList.remove('hidden');
  canvas.width = certState.imageWidth;
  canvas.height = certState.imageHeight;

  let currentY = parseInt($('cert-y-pos').value, 10);
  if (isNaN(currentY) || currentY <= 0) {
    currentY = Math.round(certState.imageHeight * 0.55);
  }
  certState.selectedCoordY = currentY;

  drawCoordsGuide(currentY);

  canvas.onmousemove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleY = canvas.height / rect.height;
    const mouseImageY = Math.round((e.clientY - rect.top) * scaleY);
    drawCoordsGuide(mouseImageY);

    const tooltip = $('coords-tooltip');
    if (tooltip) {
      tooltip.style.display = 'block';
      tooltip.style.left = `${e.clientX - rect.left}px`;
      tooltip.style.top = `${e.clientY - rect.top - 10}px`;
      tooltip.textContent = `Y: ${mouseImageY}px (Click to select)`;
    }
  };

  canvas.onmouseleave = () => {
    const tooltip = $('coords-tooltip');
    if (tooltip) tooltip.style.display = 'none';
    drawCoordsGuide(certState.selectedCoordY);
  };

  canvas.onclick = (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleY = canvas.height / rect.height;
    const clickImageY = Math.round((e.clientY - rect.top) * scaleY);
    certState.selectedCoordY = clickImageY;
    drawCoordsGuide(clickImageY);
    $('coords-selected-y').textContent = clickImageY;
    applyCoords();
    showToast(`Y position set to ${clickImageY}px`, 'success');
  };
}

function drawCoordsGuide(targetY) {
  const canvas = $('coords-canvas');
  if (!canvas || !certState.templateImage) return;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(certState.templateImage, 0, 0);

  // Red horizontal guideline
  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  ctx.moveTo(0, targetY);
  ctx.lineTo(canvas.width, targetY);
  ctx.stroke();
  ctx.restore();

  // Draw Sample Candidate Name
  const fontSize = parseInt($('cert-font-size').value, 10) || 60;
  const fontColor = $('cert-font-color').value || '#000000';
  const fontFamily = $('cert-font-family').value || 'Arial, sans-serif';
  const fontWeight = $('cert-font-weight').value || 'bold';

  ctx.save();
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = fontColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Sample Name (Preview)', canvas.width / 2, targetY);
  ctx.restore();

  if ($('coords-selected-y')) {
    $('coords-selected-y').textContent = Math.round(targetY);
  }
}

function closeCoordsModal() {
  $('cert-coords-modal').classList.add('hidden');
}

function applyCoords() {
  $('cert-y-pos').value = certState.selectedCoordY;
  closeCoordsModal();
}

async function startBulkCertificateGeneration() {
  if (!certState.templateImage) {
    showToast('Please upload a certificate template image (.png, .jpg)', 'warning');
    return;
  }

  if (!certState.excelData || !certState.excelData.length) {
    showToast('Please upload an Excel file (.xlsx) containing participant names', 'warning');
    return;
  }

  const rawColName = $('cert-column-name').value.trim();
  if (!rawColName) {
    showToast('Please specify the Excel column name (e.g. name)', 'warning');
    return;
  }

  const firstRow = certState.excelData[0] || {};
  const exactKey = Object.keys(firstRow).find(k => k === rawColName);
  const matchedCol = exactKey || Object.keys(firstRow).find(k => k.trim().toLowerCase() === rawColName.toLowerCase());

  if (!matchedCol) {
    const available = Object.keys(firstRow).join(', ');
    showToast(`Column "${rawColName}" not found in Excel. Available: ${available}`, 'error', 6000);
    return;
  }

  const names = certState.excelData
    .map(row => String(row[matchedCol] || '').trim())
    .filter(name => name.length > 0);

  if (!names.length) {
    showToast(`No names found in column "${matchedCol}"`, 'error');
    return;
  }

  if (typeof JSZip === 'undefined') {
    showToast('ZIP compression library is loading, please wait...', 'warning');
    return;
  }

  const yPos = parseInt($('cert-y-pos').value, 10);
  if (isNaN(yPos) || yPos <= 0) {
    showToast('Please enter a valid Y Axis Position number', 'warning');
    return;
  }

  const fontSize = parseInt($('cert-font-size').value, 10) || 60;
  const fontColor = $('cert-font-color').value || '#000000';
  const fontFamily = $('cert-font-family').value || 'Arial, sans-serif';
  const fontWeight = $('cert-font-weight').value || 'bold';

  const genBtn = $('cert-generate-btn');
  const progressBox = $('cert-progress-box');
  const progressBar = $('cert-progress-bar-fill');
  const progressStatus = $('cert-progress-status');
  const resultBox = $('cert-result-box');

  genBtn.disabled = true;
  progressBox.classList.remove('hidden');
  resultBox.classList.add('hidden');
  progressBar.style.width = '0%';
  progressStatus.textContent = `Starting generation for ${names.length} certificates...`;

  try {
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = certState.imageWidth;
    offscreenCanvas.height = certState.imageHeight;
    const ctx = offscreenCanvas.getContext('2d');

    const zip = new JSZip();
    const total = names.length;

    // Ensure fonts are loaded before drawing
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    for (let i = 0; i < total; i++) {
      const name = names[i];
      ctx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
      ctx.drawImage(certState.templateImage, 0, 0);

      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      ctx.fillStyle = fontColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, offscreenCanvas.width / 2, yPos);

      const dataUrl = offscreenCanvas.toDataURL('image/png');
      const base64Data = dataUrl.split(',')[1];
      const safeName = name.replace(/[^\w\s-]/gi, '').trim().replace(/\s+/g, '_') || `Certificate_${i + 1}`;
      const filename = `${safeName}.png`;
      zip.file(filename, base64Data, { base64: true });

      if (i === 0) {
        certState.sampleDataUrl = dataUrl;
        certState.sampleName = name;
      }

      const percent = Math.round(((i + 1) / total) * 85);
      progressBar.style.width = `${percent}%`;
      progressStatus.textContent = `Generated certificate ${i + 1} of ${total}: "${name}"`;

      if (i % 3 === 0) {
        await new Promise(res => setTimeout(res, 0));
      }
    }

    progressStatus.textContent = 'Compressing certificates into ZIP archive...';
    progressBar.style.width = '90%';

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    }, (meta) => {
      const pct = 90 + Math.round(meta.percent * 0.1);
      progressBar.style.width = `${pct}%`;
    });

    certState.generatedZipBlob = zipBlob;
    progressBar.style.width = '100%';
    progressBox.classList.add('hidden');
    resultBox.classList.remove('hidden');
    $('cert-result-desc').textContent = `${total} certificates successfully generated and packaged.`;

    const zipFileName = `Certificates_${Date.now()}.zip`;
    downloadBlob(zipBlob, zipFileName);
    showToast(`Generated ${total} certificates! Downloading ZIP...`, 'success', 6000);
  } catch (err) {
    console.error(err);
    showToast(`Error during certificate generation: ${err.message}`, 'error', 8000);
    progressBox.classList.add('hidden');
  } finally {
    genBtn.disabled = false;
  }
}

function openSamplePreviewModal() {
  if (!certState.sampleDataUrl) {
    showToast('No generated certificate sample to preview yet', 'info');
    return;
  }

  $('cert-preview-img').src = certState.sampleDataUrl;
  $('cert-preview-caption').textContent = `Generated Sample: ${certState.sampleName || 'Candidate'}`;
  const singleBtn = $('download-single-sample-btn');
  singleBtn.href = certState.sampleDataUrl;
  singleBtn.download = `Certificate_${(certState.sampleName || 'Sample').replace(/\s+/g, '_')}.png`;

  $('cert-preview-modal').classList.remove('hidden');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 2000);
}
