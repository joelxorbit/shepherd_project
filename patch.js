const fs = require('fs');
const path = require('path');

const adminJsPath = path.join(__dirname, 'public/js/admin.js');
let code = fs.readFileSync(adminJsPath, 'utf8');

// 1. Navigation updates
code = code.replace(
  `  $('menu-templates').addEventListener('click', () => {
    $('menu-templates').classList.add('active');
    $('menu-reports').classList.remove('active');
    $('content-templates').classList.remove('hidden');
    $('content-reports').classList.add('hidden');
    $('content-template-form').classList.add('hidden');
    loadTemplates();
  });`,
  `  $('menu-templates').addEventListener('click', () => {
    $('menu-templates').classList.add('active');
    $('menu-reports').classList.remove('active');
    $('menu-edit-table')?.classList.remove('active');
    $('content-templates').classList.remove('hidden');
    $('content-reports').classList.add('hidden');
    $('content-template-form').classList.add('hidden');
    $('content-edit-table')?.classList.add('hidden');
    loadTemplates();
  });`
);

code = code.replace(
  `  $('menu-reports').addEventListener('click', () => {
    $('menu-reports').classList.add('active');
    $('menu-templates').classList.remove('active');
    $('content-reports').classList.remove('hidden');
    $('content-templates').classList.add('hidden');
    $('content-template-form').classList.add('hidden');
    loadReports();
  });`,
  `  $('menu-reports').addEventListener('click', async () => {
    $('menu-reports').classList.add('active');
    $('menu-templates').classList.remove('active');
    $('menu-edit-table')?.classList.remove('active');
    $('content-reports').classList.remove('hidden');
    $('content-templates').classList.add('hidden');
    $('content-template-form').classList.add('hidden');
    $('content-edit-table')?.classList.add('hidden');
    await loadColumns();
    loadReports();
  });

  $('menu-edit-table')?.addEventListener('click', async () => {
    $('menu-edit-table').classList.add('active');
    $('menu-reports').classList.remove('active');
    $('menu-templates').classList.remove('active');
    $('content-edit-table').classList.remove('hidden');
    $('content-reports').classList.add('hidden');
    $('content-templates').classList.add('hidden');
    $('content-template-form').classList.add('hidden');
    await loadColumns();
    renderColumns();
  });`
);

// 2. Add Report Logic (MODIFIED for dynamic inputType)
code = code.replace(
  `  $('add-report-btn').addEventListener('click', () => {
    currentEditingReportId = null;
    $('report-village-name').value = '';
    $('report-issue').value = '';
    $('report-status').value = 'Pending';
    $('add-report-modal').querySelector('h2').textContent = 'Add Report';
    $('add-report-modal').classList.remove('hidden');
  });`,
  `  $('add-report-btn').addEventListener('click', () => {
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
  });`
);

// 3. New Variables and Load Columns logic
const columnsLogic = `
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
    searchSelect.innerHTML = currentColumns.map(c => \`<option value="\${c.key}">\${c.label}</option>\`).join('');
    if(currentColumns.find(c => c.key === currentSearch)) searchSelect.value = currentSearch;
  }

  const table = $('reports-table');
  if(table) {
    const thead = table.querySelector('thead tr');
    thead.innerHTML = currentColumns.map(c => \`<th style="padding: 12px;">\${c.label}</th>\`).join('') + '<th style="padding: 12px;">Actions</th>';
  }

  const dynamicFields = $('dynamic-report-fields');
  if(dynamicFields) {
    dynamicFields.innerHTML = currentColumns.map(c => {
      if(c.inputType === 'select') {
        const options = (c.options || '').split(',').map(o => o.trim()).filter(o => o);
        const optionsHtml = options.map(o => \`<option value="\${o}">\${o}</option>\`).join('');
        return \`<div class="form-group" style="margin-bottom: 15px;">
          <label class="form-label">\${c.label}</label>
          <select id="report-field-\${c.key}" class="form-input">
            \${optionsHtml}
          </select>
        </div>\`;
      }
      return \`<div class="form-group" style="margin-bottom: 15px;">
        <label class="form-label">\${c.label}</label>
        <input type="text" id="report-field-\${c.key}" class="form-input" />
      </div>\`;
    }).join('');
  }
}
`;
code = code.replace('// ─── Reports API Logic ───', '// ─── Reports API Logic ───\n' + columnsLogic);

// 4. Update renderReports (MODIFIED for generic pill for select type)
code = code.replace(
  `  tbody.innerHTML = reports.map(r => \`
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 12px;">\${r.villageName || 'N/A'}</td>
      <td style="padding: 12px;">\${r.issue || 'N/A'}</td>
      <td style="padding: 12px;">
        <span style="padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; background: \${r.status === 'Resolved' ? '#d4edda' : r.status === 'In Progress' ? '#fff3cd' : '#f8d7da'}; color: \${r.status === 'Resolved' ? '#155724' : r.status === 'In Progress' ? '#856404' : '#721c24'};">
          \${r.status || 'Pending'}
        </span>
      </td>
      <td style="padding: 12px;">
        <div style="display: flex; gap: 10px; align-items: center;">
          <button class="icon-btn edit-report-btn" data-id="\${r._id}" title="Edit">✏️</button>
          <button class="icon-btn delete-report-btn" data-id="\${r._id}" title="Delete">🗑️</button>
        </div>
      </td>
    </tr>
  \`).join('');`,
  `  tbody.innerHTML = reports.map(r => \`
    <tr style="border-bottom: 1px solid #eee;">
      \${currentColumns.map(c => {
        if(c.inputType === 'select') {
          return \`<td style="padding: 12px;">
            <span style="padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; background: #e2e8f0; color: #1e293b;">
              \${r[c.key] || 'N/A'}
            </span>
          </td>\`;
        }
        return \`<td style="padding: 12px;">\${r[c.key] || 'N/A'}</td>\`;
      }).join('')}
      <td style="padding: 12px;">
        <div style="display: flex; gap: 10px; align-items: center;">
          <button class="icon-btn edit-report-btn" data-id="\${r._id}" title="Edit">✏️</button>
          <button class="icon-btn delete-report-btn" data-id="\${r._id}" title="Delete">🗑️</button>
        </div>
      </td>
    </tr>
  \`).join('');`
);

// 5. Update openEditReport
code = code.replace(
  `  currentEditingReportId = id;
  $('report-village-name').value = report.villageName;
  $('report-issue').value = report.issue;
  $('report-status').value = report.status;
  $('add-report-modal').querySelector('h2').textContent = 'Edit Report';`,
  `  currentEditingReportId = id;
  currentColumns.forEach(col => {
    const el = $( 'report-field-' + col.key );
    if(el) {
      el.value = report[col.key] || (col.inputType === 'select' ? ((col.options||'').split(',')[0]||'').trim() : '');
    }
  });
  $('add-report-modal').querySelector('h2').textContent = 'Edit Report';`
);

// 6. Update saveReport
code = code.replace(
  `async function saveReport() {
  const villageName = $('report-village-name').value.trim();
  const issue = $('report-issue').value.trim();
  const status = $('report-status').value;

  if (!villageName || !issue || !status) {
    showToast('All fields are required', 'warning');
    return;
  }

  try {
    const url = currentEditingReportId ? \`/api/report/\${currentEditingReportId}\` : '/api/report';
    const method = currentEditingReportId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ villageName, issue, status })
    });`,
  `async function saveReport() {
  const payload = {};
  for(let col of currentColumns) {
    const el = $('report-field-' + col.key);
    if(el) payload[col.key] = el.value.trim();
  }

  try {
    const url = currentEditingReportId ? \`/api/report/\${currentEditingReportId}\` : '/api/report';
    const method = currentEditingReportId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });`
);

// Resetting logic in saveReport success
code = code.replace(
  `      $('report-village-name').value = '';
      $('report-issue').value = '';
      $('report-status').value = 'Pending';`,
  `      currentColumns.forEach(col => {
        const el = $( 'report-field-' + col.key );
        if(el) el.value = col.inputType === 'select' ? ((col.options||'').split(',')[0]||'').trim() : '';
      });`
);

// Dynamic Export
code = code.replace(
  `  const headers = ['Village Name', 'Issue', 'Status', 'Date Created'];
  csvRows.push(headers.join(','));

  currentReports.forEach(r => {
    const row = [
      \`"\${(r.villageName || '').replace(/"/g, '""')}"\`,
      \`"\${(r.issue || '').replace(/"/g, '""')}"\`,
      \`"\${(r.status || '').replace(/"/g, '""')}"\`,
      \`"\${new Date(r.createdAt).toLocaleDateString()}"\`
    ];
    csvRows.push(row.join(','));
  });`,
  `  const headers = currentColumns.map(c => c.label).concat(['Date Created']);
  csvRows.push(headers.join(','));

  currentReports.forEach(r => {
    const row = currentColumns.map(c => \`"\${(r[c.key] || '').toString().replace(/"/g, '""')}"\`);
    row.push(\`"\${new Date(r.createdAt).toLocaleDateString()}"\`);
    csvRows.push(row.join(','));
  });`
);


// 7. Add Column management logic at the end
code += `

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
  tbody.innerHTML = currentColumns.map(c => \`
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 12px;">\${c.label}</td>
      <td style="padding: 12px;">\${c.key}</td>
      <td style="padding: 12px;">\${c.order}</td>
      <td style="padding: 12px;">
        <div style="display: flex; gap: 10px; align-items: center;">
          <button class="icon-btn edit-column-btn" data-id="\${c._id}" title="Edit">✏️</button>
          <button class="icon-btn delete-column-btn" data-id="\${c._id}" title="Delete">🗑️</button>
        </div>
      </td>
    </tr>
  \`).join('');

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
          const res = await fetch(\`/api/report-column/\${id}\`, { method: 'DELETE', headers: getHeaders() });
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
    const url = currentEditingColumnId ? \`/api/report-column/\${currentEditingColumnId}\` : '/api/report-column';
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
`;

fs.writeFileSync(adminJsPath, code);
console.log('admin.js completely repatched from scratch!');
