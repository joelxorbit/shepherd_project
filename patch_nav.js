const fs = require('fs');
const path = require('path');

const adminJsPath = path.join(__dirname, 'public/js/admin.js');
let code = fs.readFileSync(adminJsPath, 'utf8');

// Using split/replace safely
const startToken = "// Navigation";
const endToken = "// Reports Events";

const startIndex = code.indexOf(startToken);
const endIndex = code.indexOf(endToken);

if (startIndex !== -1 && endIndex !== -1) {
  const newBlock = `// Navigation
  $('menu-templates').addEventListener('click', () => {
    $('menu-templates').classList.add('active');
    $('menu-reports').classList.remove('active');
    if($('menu-edit-table')) $('menu-edit-table').classList.remove('active');
    $('content-templates').classList.remove('hidden');
    $('content-reports').classList.add('hidden');
    $('content-template-form').classList.add('hidden');
    if($('content-edit-table')) $('content-edit-table').classList.add('hidden');
    loadTemplates();
  });

  $('menu-reports').addEventListener('click', async () => {
    $('menu-reports').classList.add('active');
    $('menu-templates').classList.remove('active');
    if($('menu-edit-table')) $('menu-edit-table').classList.remove('active');
    $('content-reports').classList.remove('hidden');
    $('content-templates').classList.add('hidden');
    $('content-template-form').classList.add('hidden');
    if($('content-edit-table')) $('content-edit-table').classList.add('hidden');
    await loadColumns();
    loadReports();
  });

  if($('menu-edit-table')) {
    $('menu-edit-table').addEventListener('click', async () => {
      $('menu-edit-table').classList.add('active');
      $('menu-reports').classList.remove('active');
      $('menu-templates').classList.remove('active');
      if($('content-edit-table')) $('content-edit-table').classList.remove('hidden');
      $('content-reports').classList.add('hidden');
      $('content-templates').classList.add('hidden');
      $('content-template-form').classList.add('hidden');
      await loadColumns();
      renderColumns();
    });
  }

  `;

  code = code.substring(0, startIndex) + newBlock + code.substring(endIndex);
  fs.writeFileSync(adminJsPath, code);
  console.log('Navigation patched successfully using substring');
} else {
  console.log('Could not find tokens');
}
