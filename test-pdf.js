const docxConverter = require('docx-pdf');
const path = require('path');

console.log('Testing docx-pdf...');
docxConverter(path.join(__dirname, 'template.docx'), path.join(__dirname, 'test.pdf'), (err, result) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Success:', result);
  }
});
