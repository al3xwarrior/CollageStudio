const MAX_IMAGE_EDGE = 1400;
const STORAGE_IMAGE_QUALITY = 0.82;

export async function createImageRecord(file) {
  const rawDataUrl = await readFileAsDataUrl(file);
  const sourceImage = await loadImageElement(rawDataUrl);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(sourceImage.naturalWidth, sourceImage.naturalHeight));
  const width = Math.max(1, Math.round(sourceImage.naturalWidth * scale));
  const height = Math.max(1, Math.round(sourceImage.naturalHeight * scale));
  const resizeCanvas = document.createElement('canvas');
  const context = resizeCanvas.getContext('2d');

  resizeCanvas.width = width;
  resizeCanvas.height = height;
  context.drawImage(sourceImage, 0, 0, width, height);

  return {
    id: crypto.randomUUID(),
    name: file.name,
    type: file.type || 'image/jpeg',
    width,
    height,
    dataUrl: resizeCanvas.toDataURL('image/jpeg', STORAGE_IMAGE_QUALITY),
    crop: null,
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}
