/**
 * Resolve a public HTTPS image URL from Cloudinary upload result or multer file.
 * Never returns /uploads/undefined
 */
function getFileUrl(fileOrResult) {
  if (!fileOrResult) return null;

  // Our uploadBuffer result
  if (typeof fileOrResult.url === 'string' && fileOrResult.url.startsWith('http')) {
    return fileOrResult.url;
  }
  if (typeof fileOrResult.secure_url === 'string' && fileOrResult.secure_url.startsWith('http')) {
    return fileOrResult.secure_url;
  }

  // multer-storage-cloudinary style
  if (typeof fileOrResult.path === 'string' && fileOrResult.path.startsWith('http')) {
    return fileOrResult.path;
  }

  if (typeof fileOrResult.filename === 'string' && fileOrResult.filename.startsWith('http')) {
    return fileOrResult.filename;
  }

  console.error('getFileUrl failed. Keys:', Object.keys(fileOrResult || {}));
  return null;
}

module.exports = { getFileUrl };
