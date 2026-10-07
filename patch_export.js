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

replaceBlock(
  "function exportReports() {",
  "const csvData = csvRows.join('\\n');",
  `function exportReports() {
  if (currentReports.length === 0) {
    showToast('No data to export', 'warning');
    return;
  }

  const csvRows = [];
  const headers = currentColumns.map(c => c.label).concat(['Date Created']);
  csvRows.push(headers.join(','));

  currentReports.forEach(r => {
    const row = currentColumns.map(c => \`"\${(r[c.key] || '').toString().replace(/"/g, '""')}"\`);
    row.push(\`"\${new Date(r.createdAt).toLocaleDateString()}"\`);
    csvRows.push(row.join(','));
  });

  const csvData = csvRows.join('\\n');`
);

if (code.indexOf("function exportReports() {") !== -1 && code.indexOf("const csvData = csvRows.join('\\n');") === -1) {
  replaceBlock(
    "function exportReports() {",
    "const csvData = csvRows.join('\\r\\n');",
    `function exportReports() {
    if (currentReports.length === 0) {
      showToast('No data to export', 'warning');
      return;
    }

    const csvRows = [];
    const headers = currentColumns.map(c => c.label).concat(['Date Created']);
    csvRows.push(headers.join(','));

    currentReports.forEach(r => {
      const row = currentColumns.map(c => \`"\${(r[c.key] || '').toString().replace(/"/g, '""')}"\`);
      row.push(\`"\${new Date(r.createdAt).toLocaleDateString()}"\`);
      csvRows.push(row.join(','));
    });

    const csvData = csvRows.join('\\n');`
  );
}

fs.writeFileSync(adminJsPath, code);
console.log("Export functionality patched successfully.");
