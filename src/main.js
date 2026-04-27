import './styles.css';
import { createCollageLayout } from './utils/collageRenderer.js';
import { shuffleItems } from './utils/collection.js';
import { createImageRecord } from './utils/imageFiles.js';
import { clamp } from './utils/math.js';
import { clearProjectImages, loadProjectImages, saveProjectImages } from './utils/storage.js';
import { createCropModal } from './ui/cropModal.js';
import { elements } from './ui/dom.js';
import { createImageGrid } from './ui/imageGrid.js';
import { createPreviewStage } from './ui/previewStage.js';
import { createSettingsPanel } from './ui/settingsPanel.js';
import { setupTabs } from './ui/tabs.js';

let selectedImages = [];
let currentRenderOrder = [];
let hasRenderedPreview = false;
let lastRenderedLayoutStyle = null;
let renderRequestId = 0;

const previewStage = createPreviewStage(elements);
const settingsPanel = createSettingsPanel(elements, handleSettingsChange);
const imageGrid = createImageGrid(elements, {
  onCrop: openCropModal,
  onRemove: removeImage,
});
const cropModal = createCropModal(elements, {
  onApply: applyCrop,
});

function getOrderedImages() {
  const stageOrder = previewStage.getRenderOrder();
  const preferredOrder = stageOrder.length > 0 ? stageOrder : currentRenderOrder;
  const imagesById = new Map(selectedImages.map((image) => [image.id, image]));
  const orderedImages = preferredOrder.map((id) => imagesById.get(id)).filter(Boolean);
  const missingImages = selectedImages.filter((image) => !preferredOrder.includes(image.id));

  return [...orderedImages, ...missingImages];
}

function persistProjectImages() {
  saveProjectImages(selectedImages);
}

function setRenderingState(isBusy) {
  elements.generateButton.disabled = isBusy;
  elements.regenerateButton.disabled = isBusy || selectedImages.length === 0;
  elements.downloadButton.disabled = isBusy || !hasRenderedPreview;
}

function handleSettingsChange(settings) {
  const layoutChanged = hasRenderedPreview && settings.layoutStyle !== lastRenderedLayoutStyle;

  if (!hasRenderedPreview || selectedImages.length === 0) {
    return;
  }

  renderPreview({
    allowReorder: layoutChanged,
    preserveTransforms: !layoutChanged,
    randomizeLayout: layoutChanged,
    settingsOverride: settings,
    shuffle: layoutChanged,
  });
}

async function handleImageUpload(event) {
  const files = Array.from(event.target.files || event.dataTransfer?.files || []).filter((file) =>
    file.type.startsWith('image/'),
  );

  if (files.length === 0) {
    return;
  }

  elements.dropzone.classList.add('is-loading');
  elements.dropzone.querySelector('.dropzone-title').textContent = 'Preparing images...';

  try {
    const imageRecords = await Promise.all(files.map(createImageRecord));
    const nextImages = [...selectedImages, ...imageRecords];

    saveProjectImages(nextImages);
    selectedImages = nextImages;
    currentRenderOrder = selectedImages.map((image) => image.id);
    imageGrid.render(selectedImages);
  } catch (error) {
    console.error('Image upload failed', error);
    window.alert('One or more images could not be loaded. Try a different image file.');
  } finally {
    elements.dropzone.classList.remove('is-loading');
    elements.dropzone.querySelector('.dropzone-title').textContent = 'Select images';
    elements.imageInput.value = '';
  }
}

function removeImage(imageId) {
  selectedImages = selectedImages.filter((image) => image.id !== imageId);
  currentRenderOrder = currentRenderOrder.filter((id) => id !== imageId);
  persistProjectImages();
  imageGrid.render(selectedImages);

  if (selectedImages.length === 0) {
    showEmptyPreview();
    return;
  }

  if (hasRenderedPreview) {
    renderPreview({ preserveTransforms: true, randomizeLayout: false });
  }
}

function openCropModal(imageId) {
  cropModal.open(selectedImages.find((image) => image.id === imageId));
}

function applyCrop(imageId, crop) {
  const image = selectedImages.find((item) => item.id === imageId);

  if (!image) {
    return;
  }

  image.crop = crop;
  persistProjectImages();
  imageGrid.render(selectedImages);

  if (hasRenderedPreview) {
    renderPreview({ preserveTransforms: true, randomizeLayout: false });
  }
}

function clearAllImages() {
  selectedImages = [];
  currentRenderOrder = [];
  clearProjectImages();
  imageGrid.render(selectedImages);
  showEmptyPreview();
}

async function renderPreview({
  allowReorder = true,
  preserveTransforms = false,
  randomizeLayout = true,
  settingsOverride = null,
  shuffle = false,
} = {}) {
  if (selectedImages.length === 0) {
    window.alert('Add at least one image before generating a collage.');
    return;
  }

  const settings = settingsOverride || settingsPanel.getSettings();
  const previousTransforms = preserveTransforms ? previewStage.getTransforms() : null;
  const imagesForRender = shuffle ? shuffleItems(getOrderedImages()) : getOrderedImages();
  const requestId = (renderRequestId += 1);

  currentRenderOrder = imagesForRender.map((image) => image.id);
  settingsPanel.save(settings);
  previewStage.prepareRender(settings.backgroundColor);
  setRenderingState(true);

  try {
    const layout = await createCollageLayout(imagesForRender, settings, {
      allowReorder,
      randomize: randomizeLayout,
    });

    if (requestId !== renderRequestId) {
      return;
    }

    if (previousTransforms) {
      applyStageTransforms(layout, previousTransforms);
    }

    currentRenderOrder = layout.items.map((item) => item.imageId);
    previewStage.render(layout);
    hasRenderedPreview = true;
    lastRenderedLayoutStyle = settings.layoutStyle;
    elements.previewMeta.textContent = `${imagesForRender.length} image${imagesForRender.length === 1 ? '' : 's'} rendered as ${
      settings.layoutStyle
    }`;
  } catch (error) {
    console.error('Collage rendering failed', error);
    previewStage.showEmpty('The collage could not be rendered. Try a different layout or fewer images.');
    hasRenderedPreview = false;
  } finally {
    if (requestId === renderRequestId) {
      setRenderingState(false);
    }
  }
}

function downloadCollage() {
  if (!hasRenderedPreview) {
    return;
  }

  const exportResult = previewStage.exportImage(settingsPanel.getSettings());

  if (!exportResult) {
    return;
  }

  const link = document.createElement('a');
  link.href = exportResult.dataUrl;
  link.download = `collage-studio.${exportResult.extension}`;
  link.click();
}

function showEmptyPreview() {
  previewStage.showEmpty();
  hasRenderedPreview = false;
  elements.downloadButton.disabled = true;
}

function applyStageTransforms(layout, transformsByImageId) {
  layout.items.forEach((item) => {
    const transform = transformsByImageId.get(item.imageId);

    if (!transform) {
      return;
    }

    item.x = clamp(transform.x, 0, layout.width) - item.width / 2;
    item.y = clamp(transform.y, 0, layout.height) - item.height / 2;
    item.rotation = transform.rotation;
  });
}

function setupDragAndDrop() {
  ['dragenter', 'dragover'].forEach((eventName) => {
    elements.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropzone.classList.add('is-dragging');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    elements.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropzone.classList.remove('is-dragging');
    });
  });

  elements.dropzone.addEventListener('drop', handleImageUpload);
}

function setupEventListeners() {
  elements.imageInput.addEventListener('change', handleImageUpload);
  elements.clearButton.addEventListener('click', clearAllImages);
  elements.generateButton.addEventListener('click', () => renderPreview());
  elements.regenerateButton.addEventListener('click', () => renderPreview({ shuffle: true }));
  elements.downloadButton.addEventListener('click', downloadCollage);
  elements.sendBackwardButton.addEventListener('click', () => previewStage.moveSelectedLayer(-1));
  elements.bringForwardButton.addEventListener('click', () => previewStage.moveSelectedLayer(1));
  elements.rotateLeftButton.addEventListener('click', () => previewStage.rotateSelectedImage(-8));
  elements.rotateRightButton.addEventListener('click', () => previewStage.rotateSelectedImage(8));
}

function initializeEditor() {
  selectedImages = loadProjectImages();
  currentRenderOrder = selectedImages.map((image) => image.id);

  settingsPanel.load();
  settingsPanel.setup();
  imageGrid.setup();
  cropModal.setup();
  setupTabs(elements.tabButtons, elements.tabPanels);
  setupDragAndDrop();
  setupEventListeners();

  imageGrid.render(selectedImages);
  showEmptyPreview();
}

initializeEditor();
