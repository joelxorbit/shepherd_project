const fs = require('fs');
const xml = fs.readFileSync('temp_unzip/word/document.xml', 'utf8');

// Check for tables
const tables = xml.match(/<w:tbl[\s>]/g);
console.log('Tables:', tables ? tables.length : 0);

// Check for table cells
const cells = xml.match(/<w:tc[\s>]/g);
console.log('Cells:', cells ? cells.length : 0);

// Check for shapes
const shapes = xml.match(/<v:shape[\s>]/g) || xml.match(/<v:rect[\s>]/g);
console.log('Shapes:', shapes ? shapes.length : 0);

// Look for anything near 'PHOTO'
const textRuns = xml.match(/<w:t>.*?<\/w:t>/g);
if (textRuns) {
  const photoRuns = textRuns.filter(t => t.includes('PHOTO'));
  console.log('Photo text runs:', photoRuns);
}

// Find all text inside w:t
const allText = xml.replace(/<[^>]+>/g, '');
const idx = allText.indexOf('PHOTO_1');
console.log('Index of PHOTO_1 in pure text:', idx);
