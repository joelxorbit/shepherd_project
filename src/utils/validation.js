const ALLOWED_TEMPLATE_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_NEWSPAPER_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_PARTICIPATION_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
];

const MAX_TEMPLATE_SIZE = parseInt(process.env.MAX_TEMPLATE_SIZE) || 20 * 1024 * 1024;
const MAX_IMAGE_SIZE = parseInt(process.env.MAX_IMAGE_SIZE) || 10 * 1024 * 1024;
const MAX_PARTICIPATION_SIZE = parseInt(process.env.MAX_PARTICIPATION_SIZE) || 5 * 1024 * 1024;
const MAX_PHOTOS = 20;

function validateTemplate(file) {
  if (!file) return 'No template file provided';
  if (!ALLOWED_TEMPLATE_TYPES.includes(file.mimetype)) {
    return 'Only .docx Word templates are supported';
  }
  if (file.size > MAX_TEMPLATE_SIZE) {
    return `Template file must be smaller than ${MAX_TEMPLATE_SIZE / 1048576} MB`;
  }
  return null;
}

function validateImage(file) {
  if (!file) return 'No image file provided';
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    return 'Only JPG, PNG, and WebP images are supported';
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return `Image must be smaller than ${MAX_IMAGE_SIZE / 1048576} MB`;
  }
  return null;
}

function validateNewspaper(file) {
  if (!file) return 'No newspaper clipping file provided';
  if (!ALLOWED_NEWSPAPER_TYPES.includes(file.mimetype)) {
    return 'Only JPG and PNG images are supported for newspaper clippings';
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return `File must be smaller than ${MAX_IMAGE_SIZE / 1048576} MB`;
  }
  return null;
}

function validateParticipation(file) {
  if (!file) return 'No participation file provided';
  if (!ALLOWED_PARTICIPATION_TYPES.includes(file.mimetype)) {
    return 'Only Excel (.xlsx, .xls) or CSV files are supported';
  }
  if (file.size > MAX_PARTICIPATION_SIZE) {
    return `File must be smaller than ${MAX_PARTICIPATION_SIZE / 1048576} MB`;
  }
  return null;
}

function validatePhotos(files) {
  if (!files || files.length === 0) return null; // Photos are optional
  if (files.length > MAX_PHOTOS) return `Maximum ${MAX_PHOTOS} photos are allowed`;
  for (const file of files) {
    const err = validateImage(file);
    if (err) return err;
  }
  return null;
}

function validateGenerateRequest(body) {
  const errors = [];
  if (!body.templateId) errors.push('Template ID is required. Please upload a Word template first.');
  return errors;
}

module.exports = {
  validateTemplate,
  validateImage,
  validateNewspaper,
  validateParticipation,
  validatePhotos,
  validateGenerateRequest,
};
