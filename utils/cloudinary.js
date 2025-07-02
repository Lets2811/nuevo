const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: 'dqkstgdgm',
  api_key: '385283717718571',
  api_secret: '2D4vc-nWrqSY0ckNTDeRe90xU0o',
});

/**
 * Sube un archivo a Cloudinary
 * @param {string} filePath - Ruta local del archivo
 * @param {string} publicId - Ruta pública (carpeta/archivo) en Cloudinary
 * @returns {Promise<object>} - Resultado de Cloudinary
 */
async function cloudinaryUpload(filePath, publicId) {
    return cloudinary.uploader.upload(filePath, {
      public_id: publicId,
      overwrite: true,
      resource_type: 'image'
    });
  }
  
  module.exports = {
    cloudinaryUpload
  };