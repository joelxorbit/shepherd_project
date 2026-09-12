const fs = require('fs');
const xml = fs.readFileSync('temp_unzip/word/document.xml', 'utf8');

// Find all shapes
const shapes = xml.match(/<(v:shape|v:rect)[^>]+>/g) || [];
shapes.forEach((shape, i) => {
  const styleMatch = shape.match(/style="([^"]+)"/);
  if (styleMatch) {
    const style = styleMatch[1];
    const widthMatch = style.match(/width:([0-9.]+)(pt|in|cm|mm)/);
    const heightMatch = style.match(/height:([0-9.]+)(pt|in|cm|mm)/);
    if (widthMatch && heightMatch) {
      console.log(`Shape ${i}: width=${widthMatch[1]}${widthMatch[2]}, height=${heightMatch[1]}${heightMatch[2]}`);
    }
  }
});
