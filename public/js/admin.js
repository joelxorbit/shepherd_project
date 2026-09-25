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
    $('content-templates').classList.remove('hidden');
    $('content-reports').classList.add('hidden');
    $('content-template-form').classList.add('hidden');
    loadTemplates();
  });

  $('menu-reports').addEventListener('click', () => {
    $('menu-reports').classList.add('active');
    $('menu-templates').classList.remove('active');
    $('content-reports').classList.remove('hidden');
    $('content-templates').classList.add('hidden');
    $('content-template-form').classList.add('hidden');
    loadReports();
  });

  // Reports Events
  $('add-report-btn').addEventListener('click', () => {
    currentEditingReportId = null;
    $('report-village-name').value = '';
    $('report-issue').value = '';
    $('report-status').value = 'Pending';
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
    tbody.innerHTML = '<tr><td colspan="4" style="padding: 12px; text-align: center;">No reports found.</td></tr>';
    return;
  }

  tbody.innerHTML = reports.map(r => `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 12px;">${r.villageName || 'N/A'}</td>
      <td style="padding: 12px;">${r.issue || 'N/A'}</td>
      <td style="padding: 12px;">
        <span style="padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; background: ${r.status === 'Resolved' ? '#d4edda' : r.status === 'In Progress' ? '#fff3cd' : '#f8d7da'}; color: ${r.status === 'Resolved' ? '#155724' : r.status === 'In Progress' ? '#856404' : '#721c24'};">
          ${r.status || 'Pending'}
        </span>
      </td>
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
  $('report-village-name').value = report.villageName;
  $('report-issue').value = report.issue;
  $('report-status').value = report.status;
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
  const villageName = $('report-village-name').value.trim();
  const issue = $('report-issue').value.trim();
  const status = $('report-status').value;

  if (!villageName || !issue || !status) {
    showToast('All fields are required', 'warning');
    return;
  }

  try {
    const url = currentEditingReportId ? `/api/report/${currentEditingReportId}` : '/api/report';
    const method = currentEditingReportId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ villageName, issue, status })
    });

    if (res.ok) {
      showToast(currentEditingReportId ? 'Report updated successfully' : 'Report added successfully', 'success');
      $('add-report-modal').classList.add('hidden');
      $('report-village-name').value = '';
      $('report-issue').value = '';
      $('report-status').value = 'Pending';
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
  const headers = ['Village Name', 'Issue', 'Status', 'Date Created'];
  csvRows.push(headers.join(','));

  currentReports.forEach(r => {
    const row = [
      `"${(r.villageName || '').replace(/"/g, '""')}"`,
      `"${(r.issue || '').replace(/"/g, '""')}"`,
      `"${(r.status || '').replace(/"/g, '""')}"`,
      `"${new Date(r.createdAt).toLocaleDateString()}"`
    ];
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
