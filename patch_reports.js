const fs = require('fs');
const path = require('path');

const adminJsPath = path.join(__dirname, 'public/js/admin.js');
let code = fs.readFileSync(adminJsPath, 'utf8');

function replaceBlock(startAnchor, endAnchor, replacement) {
  const startIndex = code.indexOf(startAnchor);
  if(startIndex === -1) {
    console.log("Failed to find start block:", startAnchor);
    return;
  }
  const endIndex = code.indexOf(endAnchor, startIndex);
  if (endIndex !== -1) {
    code = code.substring(0, startIndex) + replacement + code.substring(endIndex + endAnchor.length);
    console.log("Successfully replaced block starting with:", startAnchor.substring(0, 30));
  } else {
    console.log("Failed to find end block:", endAnchor);
  }
}

// 1. renderReports
replaceBlock(
  "function renderReports(reports) {",
  "  // Attach event listeners for edit and delete",
  `function renderReports(reports) {
  const tbody = $('reports-table-body');
  if (reports.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="padding: 12px; text-align: center;">No reports found.</td></tr>';
    return;
  }

  tbody.innerHTML = reports.map(r => \`
    <tr style="border-bottom: 1px solid #eee;">
      \${currentColumns.map(c => {
        if(c.inputType === 'select') {
          return \\\`<td style="padding: 12px;">
            <span style="padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; background: #e2e8f0; color: #1e293b;">
              \${r[c.key] || 'N/A'}
            </span>
          </td>\\\`;
        }
        return \\\`<td style="padding: 12px;">\${r[c.key] || 'N/A'}</td>\\\`;
      }).join('')}
      <td style="padding: 12px;">
        <div style="display: flex; gap: 10px; align-items: center;">
          <button class="icon-btn edit-report-btn" data-id="\${r._id}" title="Edit">✏️</button>
          <button class="icon-btn delete-report-btn" data-id="\${r._id}" title="Delete">🗑️</button>
        </div>
      </td>
    </tr>
  \`).join('');

  // Attach event listeners for edit and delete`
);

// 2. openEditReport
replaceBlock(
  "function openEditReport(id) {",
  "  $('add-report-modal').classList.remove('hidden');\r\n}",
  `function openEditReport(id) {
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
}`
);
if (code.indexOf("function openEditReport(id) {") !== -1 && code.indexOf("$('add-report-modal').classList.remove('hidden');\r\n}") === -1) {
  // Try fallback without \r
  replaceBlock(
    "function openEditReport(id) {",
    "  $('add-report-modal').classList.remove('hidden');\n}",
    `function openEditReport(id) {
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
  }`
  );
}

// 3. saveReport
replaceBlock(
  "async function saveReport() {",
  "    showToast('Server error', 'error');\r\n  }\r\n}",
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
}`
);
if (code.indexOf("async function saveReport() {") !== -1 && code.indexOf("    showToast('Server error', 'error');\r\n  }\r\n}") === -1) {
  replaceBlock(
    "async function saveReport() {",
    "    showToast('Server error', 'error');\n  }\n}",
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
  }`
  );
}


// 5. add-report-btn click
replaceBlock(
  "  $('add-report-btn').addEventListener('click', () => {",
  "    $('add-report-modal').classList.remove('hidden');\r\n  });",
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
if (code.indexOf("  $('add-report-btn').addEventListener('click', () => {") !== -1 && code.indexOf("    $('add-report-modal').classList.remove('hidden');\r\n  });") === -1) {
  replaceBlock(
    "  $('add-report-btn').addEventListener('click', () => {",
    "    $('add-report-modal').classList.remove('hidden');\n  });",
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
}

fs.writeFileSync(adminJsPath, code);
console.log("All dynamic report sections patched successfully.");
