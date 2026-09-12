# Document Automation

**Template-Preserving Document Automation System**

Upload a Microsoft Word template (`.docx`), enter your event/report content, upload photos and signature, and the system generates a professionally formatted `.docx` document that **preserves your template's exact design**.

---

## Features

- 🗂️ **Template Upload** – Upload any `.docx` Word template
- 🔍 **Automatic Placeholder Detection** – Detects all `{{PLACEHOLDER}}` tokens in your template
- 📝 **Rich Content Entry** – Event title, invitation, objectives, report description, outcome
- 📷 **Multi-Photo Support** – Upload up to 20 photos with drag-to-reorder
- ✍️ **Signature** – Upload signature image (transparent PNG preferred)
- 📰 **Newspaper Clipping** – Upload newspaper clipping image
- 👥 **Participation List** – Upload Excel/CSV or enter manually with configurable columns
- ⚡ **One-Click Generation** – Generates a `.docx` that matches your template
- 📥 **Download** – Download the generated Word document instantly

---

## Prerequisites

- **Node.js** v18 or higher — [Download](https://nodejs.org/)
- **npm** v8 or higher (comes with Node.js)

> **No other external dependencies required.** LibreOffice is NOT needed (DOCX-only output).

---

## Installation

### Windows

```powershell
# 1. Open PowerShell or Command Prompt in the project directory
cd "E:\shepherd project\web"

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

### Linux / macOS

```bash
cd /path/to/document-automation
npm install
npm run dev
```

The server starts at: **http://localhost:3000**

---

## How to Use

### 1. Prepare Your Word Template

Open Microsoft Word and create or open your `.docx` template.

Add **placeholder tokens** using double curly braces wherever you want content inserted:

```
{{EVENT_TITLE}}
{{INVITATION}}
{{DATE}}
{{VENUE}}
{{CHIEF_GUEST}}
{{DEPARTMENT}}
{{REPORT_TITLE}}
{{OBJECTIVES}}
{{REPORT}}
{{OUTCOME}}
{{PHOTO_1}}
{{PHOTO_2}}
{{PHOTO_3}}
{{PHOTO_4}}
{{SIGNATURE}}
{{NEWSPAPER_CLIPPING}}
{{PARTICIPATION_LIST}}
```

**Rules:**
- Use UPPERCASE with underscores
- Use **double curly braces**: `{{` and `}}`
- Photo placeholders: `{{PHOTO_1}}`, `{{PHOTO_2}}`, etc. (numbered)
- The template's fonts, margins, headers, footers, and design are **fully preserved**

### 2. Upload the Template

- Drag and drop your `.docx` file onto the upload area, or click **Choose File**
- The app will automatically detect all placeholders

### 3. Enter Content

Fill in all the form fields:
- **Invitation Details** – Event title, invitation text, date, venue, etc.
- **Report Details** – Report title, objectives (dynamic list), report description (rich text), outcomes
- **Photos** – Upload multiple photos, drag to reorder
- **Signature** – Upload signature image
- **Newspaper Clipping** – Upload clipping image
- **Participation List** – Upload Excel/CSV or enter manually

### 4. Generate

Click **Generate Document**. The system will:
1. Load your Word template
2. Replace all placeholders with your content
3. Insert images into photo placeholders
4. Preserve all formatting

### 5. Download

Click **Download Word Document** to save your `.docx` file.

---

## Template Placeholder Reference

| Placeholder | Type | Description |
|---|---|---|
| `{{EVENT_TITLE}}` | Text | Main event/programme title |
| `{{INVITATION}}` | Text | Full invitation body text |
| `{{DATE}}` | Text | Event date |
| `{{VENUE}}` | Text | Event venue |
| `{{CHIEF_GUEST}}` | Text | Chief guest / speaker name |
| `{{DEPARTMENT}}` | Text | Organizing department |
| `{{REPORT_TITLE}}` | Text | Report document title |
| `{{OBJECTIVES}}` | List | Numbered objectives list |
| `{{REPORT}}` | Text | Full report description |
| `{{OUTCOME}}` | List | Numbered outcomes list |
| `{{PHOTO_1}}` to `{{PHOTO_20}}` | Image | Event photos |
| `{{SIGNATURE}}` | Image | Signature image |
| `{{NEWSPAPER_CLIPPING}}` | Image | Newspaper clipping image |
| `{{PARTICIPATION_LIST}}` | Table | Participant list |
| `{{PAGE_BREAK}}` | Control | Insert page break |

---

## Project Structure

```
document-automation/
├── server.js                    ← Express entry point
├── package.json
├── .env                         ← Configuration
├── README.md
│
├── src/
│   ├── controllers/
│   │   ├── documentController.js
│   │   ├── templateController.js
│   │   └── uploadController.js
│   │
│   ├── services/
│   │   ├── templateParser.js
│   │   ├── documentGenerator.js
│   │   ├── imageProcessor.js
│   │   └── pageManager.js
│   │
│   ├── routes/
│   │   ├── documentRoutes.js
│   │   ├── templateRoutes.js
│   │   └── uploadRoutes.js
│   │
│   └── utils/
│       ├── fileUtils.js
│       ├── validation.js
│       └── placeholderUtils.js
│
├── public/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
│
├── uploads/                     ← Auto-created on first run
│   ├── templates/
│   ├── photos/
│   ├── signatures/
│   └── newspapers/
│
└── generated/                   ← Auto-created on first run
    └── docx/
```

---

## Configuration (`.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `MAX_TEMPLATE_SIZE` | `20971520` (20 MB) | Max template file size |
| `MAX_IMAGE_SIZE` | `10485760` (10 MB) | Max image file size |
| `MAX_PARTICIPATION_SIZE` | `5242880` (5 MB) | Max participation file size |
| `GENERATED_FILE_TTL` | `3600000` (1 hour) | Auto-delete generated files after this time |

---

## Troubleshooting

### "No placeholders detected"
Make sure your Word template contains `{{PLACEHOLDER}}` tokens (double curly braces, UPPERCASE). Save and re-upload.

### "Template file is corrupted"
Ensure the file is a genuine `.docx` (not `.doc`). Open it in Word first, then re-save as `.docx`.

### Image not appearing in output
The image placeholder must exist in the template as plain text, e.g. `{{PHOTO_1}}`. The placeholder must not be split across XML runs — type it directly in Word without copy-pasting formatted text.

### Generation fails with "rendering failed"
Check that your placeholder uses exactly `{{` and `}}` delimiters. Avoid smart quotes or special characters inside the braces.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/template/upload` | Upload `.docx` template |
| GET | `/api/template/:id/placeholders` | Get detected placeholders |
| POST | `/api/images/upload` | Upload photos |
| POST | `/api/signature/upload` | Upload signature |
| POST | `/api/newspaper/upload` | Upload newspaper clipping |
| POST | `/api/participation/upload` | Upload Excel/CSV participation file |
| POST | `/api/document/generate` | Generate document |
| GET | `/api/document/:id/download/docx` | Download generated DOCX |

---

## License

MIT
