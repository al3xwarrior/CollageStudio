import Konva from 'konva';
import { getContainedImageRect, getSourceRect } from '../utils/collageRenderer.js';

export function createPreviewStage(elements) {
  let stage = null;
  let contentLayer = null;
  let controlsLayer = null;
  let transformer = null;
  let selectedGroup = null;
  let currentStageScale = 1;

  function render(layout) {
    destroy();

    currentStageScale = getStageScale(layout);
    stage = new Konva.Stage({
      container: elements.konvaStageContainer,
      width: layout.width * currentStageScale,
      height: layout.height * currentStageScale,
    });
    contentLayer = new Konva.Layer({ scaleX: currentStageScale, scaleY: currentStageScale });
    controlsLayer = new Konva.Layer({ scaleX: currentStageScale, scaleY: currentStageScale });
    transformer = new Konva.Transformer({
      rotateEnabled: true,
      resizeEnabled: false,
      borderStroke: '#2563eb',
      anchorStroke: '#2563eb',
      anchorFill: '#ffffff',
    });

    contentLayer.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width: layout.width,
        height: layout.height,
        fill: layout.backgroundColor,
        name: 'stage-background',
      }),
    );
    layout.items.forEach((item) => contentLayer.add(createPhotoGroup(item)));

    controlsLayer.add(transformer);
    stage.add(contentLayer);
    stage.add(controlsLayer);
    stage.on('click tap', (event) => {
      if (event.target === stage || event.target.name() === 'stage-background') {
        clearSelection();
      }
    });
    stage.batchDraw();
  }

  function destroy() {
    if (stage) {
      stage.destroy();
    }

    stage = null;
    contentLayer = null;
    controlsLayer = null;
    transformer = null;
    selectedGroup = null;
    currentStageScale = 1;
    elements.konvaStageContainer.innerHTML = '';
  }

  function showEmpty(message = 'Upload images and generate a collage.') {
    destroy();
    elements.konvaStageContainer.hidden = true;
    elements.emptyPreviewMessage.hidden = false;
    elements.emptyPreviewMessage.textContent = message;
    elements.previewMeta.textContent = 'Generated collage preview will appear here.';
    elements.floatingImageControls.hidden = true;
  }

  function prepareRender(backgroundColor) {
    elements.generatedPlaceholder.style.backgroundColor = backgroundColor;
    elements.previewMeta.textContent = 'Rendering collage...';
    elements.emptyPreviewMessage.hidden = true;
    elements.konvaStageContainer.hidden = false;
  }

  function exportImage(settings) {
    if (!stage) {
      return null;
    }

    const isJpeg = settings.outputFormat === 'JPEG';
    const mimeType = isJpeg ? 'image/jpeg' : 'image/png';

    clearSelection();
    let dataUrl;

    try {
      controlsLayer.hide();
      dataUrl = stage.toDataURL({
        mimeType,
        quality: 0.92,
        pixelRatio: 1 / currentStageScale,
      });
    } finally {
      controlsLayer.show();
    }

    return {
      dataUrl,
      extension: isJpeg ? 'jpg' : 'png',
    };
  }

  function getTransforms() {
    if (!contentLayer) {
      return null;
    }

    return new Map(
      contentLayer
        .getChildren((node) => node.name() === 'photo-group')
        .map((node) => [
          node.imageId,
          {
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
          },
        ]),
    );
  }

  function getRenderOrder() {
    if (!contentLayer) {
      return [];
    }

    return contentLayer
      .getChildren((node) => node.name() === 'photo-group')
      .map((node) => node.imageId);
  }

  function moveSelectedLayer(direction) {
    if (!selectedGroup || !contentLayer) {
      return;
    }

    if (direction < 0 && selectedGroup.getZIndex() > 1) {
      selectedGroup.moveDown();
    }

    if (direction > 0 && selectedGroup.getZIndex() < contentLayer.getChildren().length - 1) {
      selectedGroup.moveUp();
    }

    updateSelectionOverlays();
    contentLayer.batchDraw();
  }

  function rotateSelectedImage(degrees) {
    if (!selectedGroup) {
      return;
    }

    selectedGroup.rotation(selectedGroup.rotation() + degrees);
    updateSelectionOverlays();
    controlsLayer.batchDraw();
    contentLayer.batchDraw();
  }

  function createPhotoGroup(item) {
    const group = new Konva.Group({
      x: item.x + item.width / 2,
      y: item.y + item.height / 2,
      width: item.width,
      height: item.height,
      rotation: item.rotation,
      draggable: true,
      name: 'photo-group',
    });

    group.imageId = item.imageId;
    group.on('click tap', (event) => {
      event.cancelBubble = true;
      selectGroup(group);
    });
    group.on('dragstart transformstart', () => selectGroup(group));
    group.on('dragmove transform', updateSelectionOverlays);
    group.on('dragend transformend', updateSelectionOverlays);

    if (item.variant === 'polaroid') {
      addPolaroidNodes(group, item);
    } else {
      addPhotoNodes(group, item, {
        x: -item.width / 2,
        y: -item.height / 2,
        width: item.width,
        height: item.height,
      });
    }

    group.add(
      new Konva.Rect({
        x: -item.width / 2,
        y: -item.height / 2,
        width: item.width,
        height: item.height,
        fill: '#000000',
        opacity: 0,
      }),
    );

    return group;
  }

  function addPolaroidNodes(group, item) {
    const padding = Math.max(10, item.width * 0.055);
    const caption = Math.max(22, item.height * 0.12);

    group.add(
      new Konva.Rect({
        x: -item.width / 2,
        y: -item.height / 2,
        width: item.width,
        height: item.height,
        fill: '#ffffff',
        shadowColor: 'rgba(15, 23, 42, 0.18)',
        shadowBlur: 18,
        shadowOffsetY: 8,
        listening: false,
      }),
    );
    addPhotoNodes(group, item, {
      x: -item.width / 2 + padding,
      y: -item.height / 2 + padding,
      width: item.width - padding * 2,
      height: item.height - padding * 2 - caption,
      backgroundFill: '#ffffff',
    });
  }

  function addPhotoNodes(group, item, rect) {
    const border = Math.min(
      Math.max(0, item.border || 0),
      Math.max(0, rect.width / 2 - 1),
      Math.max(0, rect.height / 2 - 1),
    );
    const backgroundFill = rect.backgroundFill || '#f8fafc';
    const source = getSourceRect(item.image);
    const innerRect = {
      x: rect.x + border,
      y: rect.y + border,
      width: rect.width - border * 2,
      height: rect.height - border * 2,
    };
    const imageRect = getContainedImageRect(source, innerRect);

    if (border > 0) {
      group.add(
        new Konva.Rect({
          ...rect,
          fill: '#ffffff',
          listening: false,
        }),
      );
    }

    group.add(
      new Konva.Rect({
        ...innerRect,
        fill: backgroundFill,
        listening: false,
      }),
    );
    group.add(
      new Konva.Image({
        image: item.image.element,
        crop: source,
        ...imageRect,
        listening: false,
      }),
    );
  }

  function selectGroup(group) {
    selectedGroup = group;
    transformer.nodes([group]);
    updateSelectionOverlays();
  }

  function clearSelection() {
    selectedGroup = null;

    if (transformer) {
      transformer.nodes([]);
      clearLayerBadges();
      controlsLayer.batchDraw();
    }

    elements.floatingImageControls.hidden = true;
  }

  function updateSelectionOverlays() {
    if (!selectedGroup || !stage || !controlsLayer) {
      return;
    }

    renderLayerBadges();
    positionFloatingControls();
    controlsLayer.batchDraw();
  }

  function renderLayerBadges() {
    clearLayerBadges();

    const photoGroups = contentLayer.getChildren((node) => node.name() === 'photo-group');

    const stageScale = Math.max(currentStageScale, 0.25);
    const badgeWidth = 54 / stageScale;
    const badgeHeight = 38 / stageScale;
    const badgeOffset = 12 / stageScale;
    const badgeRadius = 19 / stageScale;
    const badgeFontSize = 20 / stageScale;

    photoGroups.forEach((group, index) => {
      const clientRect = group.getClientRect({ relativeTo: contentLayer });
      const badge = new Konva.Group({
        x: clientRect.x + badgeOffset,
        y: clientRect.y + badgeOffset,
        name: 'layer-badge',
        listening: false,
      });

      badge.add(
        new Konva.Rect({
          width: badgeWidth,
          height: badgeHeight,
          fill: group === selectedGroup ? 'rgba(37, 99, 235, 0.88)' : 'rgba(17, 24, 39, 0.62)',
          cornerRadius: badgeRadius,
          shadowColor: 'rgba(15, 23, 42, 0.22)',
          shadowBlur: 12 / stageScale,
          shadowOffsetY: 4 / stageScale,
        }),
      );
      badge.add(
        new Konva.Text({
          text: String(index + 1),
          width: badgeWidth,
          height: badgeHeight,
          align: 'center',
          verticalAlign: 'middle',
          fill: '#ffffff',
          fontSize: badgeFontSize,
          fontStyle: 'bold',
        }),
      );
      controlsLayer.add(badge);
    });

    transformer.moveToTop();
  }

  function clearLayerBadges() {
    if (!controlsLayer) {
      return;
    }

    controlsLayer.find('.layer-badge').forEach((badge) => badge.destroy());
  }

  function positionFloatingControls() {
    const groupRect = selectedGroup.getClientRect({ relativeTo: stage });
    const stageRect = stage.container().getBoundingClientRect();
    const previewRect = elements.generatedPlaceholder.getBoundingClientRect();

    elements.floatingImageControls.hidden = false;
    elements.floatingImageControls.style.left = `${stageRect.left - previewRect.left + groupRect.x + groupRect.width / 2}px`;
    elements.floatingImageControls.style.top = `${stageRect.top - previewRect.top + groupRect.y + Math.max(8, groupRect.height * 0.08)}px`;
  }

  function getStageScale(layout) {
    const availableWidth = Math.max(320, elements.generatedPlaceholder.clientWidth - 36);
    const availableHeight = Math.max(320, window.innerHeight - 260);

    return Math.min(1, availableWidth / layout.width, availableHeight / layout.height);
  }

  return {
    destroy,
    exportImage,
    getRenderOrder,
    getTransforms,
    moveSelectedLayer,
    prepareRender,
    render,
    rotateSelectedImage,
    showEmpty,
  };
}
