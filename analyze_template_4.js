const fs = require('fs');
const xml = fs.readFileSync('temp_unzip/word/document.xml', 'utf8');

const shapeRegex = /<(v:shape|v:rect)[^>]+>(.*?)<\/(v:shape|v:rect)>/g;
let match;
while ((match = shapeRegex.exec(xml)) !== null) {
  const shape = match[0];
  const styleMatch = shape.match(/style="([^"]+)"/);
  if (styleMatch) {
    const style = styleMatch[1];
    const widthMatch = style.match(/width:([0-9.]+)(pt|in|cm|mm)/);
    const heightMatch = style.match(/height:([0-9.]+)(pt|in|cm|mm)/);
    
    // Find placeholders in this shape
    const textMatch = shape.match(/{{([A-Z0-9_]+)}}/g);
    if (textMatch) {
      console.log(`Shape (${widthMatch[1]}pt x ${heightMatch[1]}pt) contains: ${textMatch.join(', ')}`);
    }
  }
}
