const fs = require('fs');
const xml = fs.readFileSync('temp_unzip/word/document.xml', 'utf8');

const shapeRegex = /<(v:shape|v:rect)[^>]+>(.*?)<\/(v:shape|v:rect)>/g;
let match;
while ((match = shapeRegex.exec(xml)) !== null) {
  const shapeText = match[2];
  const pureText = shapeText.replace(/<[^>]+>/g, '');
  if (pureText.trim()) {
     console.log("Shape text found:", pureText);
  }
}
