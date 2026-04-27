import { escapeHtml } from '../utils/html.js';

const demoCardsMarkup = `
  <article class="image-card demo-card">
    <div class="demo-preview demo-preview-one"></div>
    <div class="card-actions">
      <button class="icon-button" type="button" aria-label="Crop demo image">Crop</button>
      <button class="icon-button danger" type="button" aria-label="Remove demo image">X</button>
    </div>
    <p>city-light.jpg</p>
  </article>
  <article class="image-card demo-card">
    <div class="demo-preview demo-preview-two"></div>
    <div class="card-actions">
      <button class="icon-button" type="button" aria-label="Crop demo image">Crop</button>
      <button class="icon-button danger" type="button" aria-label="Remove demo image">X</button>
    </div>
    <p>gallery-wall.jpg</p>
  </article>
  <article class="image-card demo-card">
    <div class="demo-preview demo-preview-three"></div>
    <div class="card-actions">
      <button class="icon-button" type="button" aria-label="Crop demo image">Crop</button>
      <button class="icon-button danger" type="button" aria-label="Remove demo image">X</button>
    </div>
    <p>weekend-trip.jpg</p>
  </article>
`;

export function createImageGrid(elements, callbacks) {
  function render(images) {
    elements.imageCount.textContent = `${images.length} selected`;
    elements.regenerateButton.disabled = images.length === 0;

    if (images.length === 0) {
      elements.imageGrid.innerHTML = demoCardsMarkup;
      return;
    }

    elements.imageGrid.innerHTML = images.map(renderImageCard).join('');
  }

  function setup() {
    elements.imageGrid.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');

      if (!button) {
        return;
      }

      const imageId = button.dataset.imageId;

      if (button.dataset.action === 'remove') {
        callbacks.onRemove(imageId);
        return;
      }

      if (button.dataset.action === 'crop') {
        callbacks.onCrop(imageId);
      }
    });
  }

  return {
    render,
    setup,
  };
}

function renderImageCard(image) {
  const safeName = escapeHtml(image.name);
  const isCropped = Boolean(image.crop);

  return `
    <article class="image-card">
      <img src="${image.dataUrl}" alt="${safeName}" />
      <div class="card-actions">
        <button class="icon-button" type="button" data-action="crop" data-image-id="${image.id}" aria-label="Crop ${safeName}">Crop</button>
        <button class="icon-button danger" type="button" data-action="remove" data-image-id="${image.id}" aria-label="Remove ${safeName}">X</button>
      </div>
      ${isCropped ? '<span class="crop-badge">Cropped</span>' : ''}
      <p title="${safeName}">${safeName}</p>
    </article>
  `;
}
