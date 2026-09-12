const fs = require('fs');
const xml = fs.readFileSync('temp_unzip/word/document.xml', 'utf8');

// The XML might have 'PHOTO_1' split, so let's just look for cell widths in the table that has 2 columns.
// A better way: just print all w:tcW values to see the general column widths.
const tcWMatch = xml.match(/<w:tcW w:w="(\d+)"/g);
if (tcWMatch) {
  const widths = tcWMatch.map(m => parseInt(m.match(/\d+/)[0], 10));
  const uniqueWidths = [...new Set(widths)].sort((a,b) => a-b);
  console.log("Unique cell widths (in twips):", uniqueWidths);
  uniqueWidths.forEach(w => {
    console.log(`- ${w} twips = ${(w / 1440).toFixed(2)} inches = ${(w / 1440 * 96).toFixed(0)} pixels`);
  });
}
