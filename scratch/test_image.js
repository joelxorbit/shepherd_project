const fs = require('fs');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const ImageModule = require('docxtemplater-image-module-free');
const sharp = require('sharp');

async function run() {
  // 1. Create a dummy template with an image placeholder
  const zipTemplate = new PizZip();
  zipTemplate.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
      <w:p><w:r><w:t>{{PHOTO_1}}</w:t></w:r></w:p>
    </w:body>
  </w:document>`);
  zipTemplate.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zipTemplate.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zipTemplate.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`);

  const templateBuffer = zipTemplate.generate({ type: "nodebuffer" });

  // 2. Generate dummy image
  const imgBuffer = await sharp({
    create: { width: 100, height: 100, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } }
  }).png().toBuffer();

  const imageModule = new ImageModule({
    centered: false,
    getImage(tagValue, tagName) {
      return imgBuffer;
    },
    getSize(img, tagValue, tagName) {
      return [100, 100];
    },
    setParser(placeHolderContent) {
      if (placeHolderContent === 'PHOTO_1') {
        return {
          type: 'placeholder',
          value: placeHolderContent,
          module: 'open-xml-templating/docxtemplater-image-module',
          centered: false,
        };
      }
      return null;
    }
  });

  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    modules: [imageModule],
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
  });

  doc.render({ PHOTO_1: true });

  const buf = doc.getZip().generate({ type: 'nodebuffer' });
  fs.writeFileSync('scratch/test_out.docx', buf);
  console.log('Generated scratch/test_out.docx');

  // analyze the contents
  const zipOut = new PizZip(buf);
  console.log("Files in output docx:");
  console.log(Object.keys(zipOut.files));
}
run().catch(console.error);
