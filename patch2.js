const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'public/js/admin.js');
let code = fs.readFileSync(file, 'utf8');

// 1. Remove the delete restriction in renderColumns HTML
code = code.replace(
  /\${!c\.isDefault \? `<button class="icon-btn delete-column-btn" data-id="\${c\._id}" title="Delete">🗑️<\/button>` : ''}/g,
  `<button class="icon-btn delete-column-btn" data-id="\${c._id}" title="Delete">🗑️</button>`
);

// 2. updateTableHeaders dynamicFields logic
const oldDynamicFieldsLogic = `      if(c.key === 'status') {
        return \`<div class="form-group" style="margin-bottom: 15px;">
          <label class="form-label">\${c.label}</label>
          <select id="report-field-\${c.key}" class="form-input">
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
          </select>
        </div>\`;
      }
      return \`<div class="form-group" style="margin-bottom: 15px;">
        <label class="form-label">\${c.label}</label>
        <input type="text" id="report-field-\${c.key}" class="form-input" />
      </div>\`;`;
      
const newDynamicFieldsLogic = `      if(c.inputType === 'select') {
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
      </div>\`;`;
      
code = code.replace(oldDynamicFieldsLogic, newDynamicFieldsLogic);

// 3. renderReports dynamic status logic
const oldRenderReportsLogic = `        if(c.key === 'status') {
          return \`<td style="padding: 12px;">
            <span style="padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; background: \${r[c.key] === 'Resolved' ? '#d4edda' : r[c.key] === 'In Progress' ? '#fff3cd' : '#f8d7da'}; color: \${r[c.key] === 'Resolved' ? '#155724' : r[c.key] === 'In Progress' ? '#856404' : '#721c24'};">
              \${r[c.key] || 'Pending'}
            </span>
          </td>\`;
        }`;
        
const newRenderReportsLogic = `        if(c.inputType === 'select') {
          return \`<td style="padding: 12px;">
            <span style="padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; background: #e2e8f0; color: #1e293b;">
              \${r[c.key] || 'N/A'}
            </span>
          </td>\`;
        }`;

code = code.replace(oldRenderReportsLogic, newRenderReportsLogic);

// 4. Default pending logic in add-report-btn
const oldAddReportLogic = `        if(col.key === 'status') el.value = 'Pending';
        else el.value = '';`;
const newAddReportLogic = `        if(col.inputType === 'select') {
          const opts = (col.options || '').split(',');
          el.value = opts.length ? opts[0].trim() : '';
        } else {
          el.value = '';
        }`;
code = code.replace(oldAddReportLogic, newAddReportLogic);

// 5. Default pending logic in openEditReport and saveReport (2 places)
code = code.replace(/col\.key === 'status' \? 'Pending' : ''/g, `col.inputType === 'select' ? ((col.options||'').split(',')[0]||'').trim() : ''`);

// 6. Add Column logic - Modal toggles
const addColListeners = `  $('add-column-btn')?.addEventListener('click', () => {
    currentEditingColumnId = null;
    $('column-label').value = '';
    $('column-key').value = '';
    $('column-key').disabled = false;
    $('column-order').value = (currentColumns.length + 1) * 10;
    $('column-input-type').value = 'text';
    $('column-options').value = '';
    $('column-options-group').style.display = 'none';
    $('column-modal-title').textContent = 'Add Column';
    $('add-column-modal').classList.remove('hidden');
  });

  $('column-input-type')?.addEventListener('change', (e) => {
    if(e.target.value === 'select') {
      $('column-options-group').style.display = 'block';
    } else {
      $('column-options-group').style.display = 'none';
    }
  });`;

code = code.replace(/  \$\('add-column-btn'\)\?\.addEventListener\('click', \(\) => {[\s\S]*?\$\('add-column-modal'\)\.classList\.remove\('hidden'\);\n  }\);/m, addColListeners);

// 7. Add Column logic - Edit Col
const editColLogic = `      if(col) {
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
      }`;
code = code.replace(/      if\(col\) {[\s\S]*?\$\('add-column-modal'\)\.classList\.remove\('hidden'\);\n      }/m, editColLogic);

// 8. Add Column logic - Save Col
const saveColStart = `async function saveColumn() {
  const label = $('column-label').value.trim();
  const key = $('column-key').value.trim();
  const order = parseInt($('column-order').value) || 0;
  const inputType = $('column-input-type') ? $('column-input-type').value : 'text';
  const options = $('column-options') ? $('column-options').value : '';

  if(!label || !key) {
    showToast('Label and Key are required', 'warning');
    return;
  }`;

const saveColBody = `    const res = await fetch(url, {
      method,
      headers: getHeaders(),
      body: JSON.stringify({ label, key, order, inputType, options })
    });`;

code = code.replace(/async function saveColumn\(\) {[\s\S]*?if\(!label \|\| !key\) {[\s\S]*?return;\n  }/m, saveColStart);
code = code.replace(/    const res = await fetch\(url, {[\s\S]*?body: JSON\.stringify\({ label, key, order }\)\n    }\);/m, saveColBody);

fs.writeFileSync(file, code);
console.log('Patch 2 applied successfully');
