import { shuffleItems } from './collection.js';
import { clamp, randomBetween } from './math.js';

const DEFAULT_SIZE = 1600;

export function getCanvasDimensions(settings) {
  if (settings.aspectRatio === 'Custom') {
    return {
      width: clamp(Number(settings.customWidth) || DEFAULT_SIZE, 256, 3000),
      height: clamp(Number(settings.customHeight) || DEFAULT_SIZE, 256, 3000),
    };
  }

  const dimensionsByRatio = {
    '1:1 Square': { width: 1600, height: 1600 },
    '16:9 Landscape': { width: 1920, height: 1080 },
    '9:16 Portrait': { width: 1080, height: 1920 },
    '4:5 Social Post': { width: 1440, height: 1800 },
  };

  return dimensionsByRatio[settings.aspectRatio] || dimensionsByRatio['1:1 Square'];
}

export async function createCollageLayout(projectImages, settings, options = {}) {
  const dimensions = getCanvasDimensions(settings);
  const images = await Promise.all(projectImages.map(loadCanvasImage));
  const layout = settings.layoutStyle || 'Masonry';
  const { allowReorder = true, randomize = true } = options;
  let items;

  if (layout === 'Scattered') {
    items = createScatteredItems(images, settings, dimensions, false, randomize);
  } else if (layout === 'Polaroid') {
    items = createPolaroidItems(images, settings, dimensions);
  } else if (layout === 'Polaroid Scattered') {
    items = createScatteredItems(images, settings, dimensions, true, randomize);
  } else {
    items = createMasonryItems(images, settings, dimensions, allowReorder);
  }

  return {
    ...dimensions,
    backgroundColor: settings.backgroundColor || '#f5f7fb',
    items,
  };
}

export function getSourceRect(image) {
  const imageWidth = image.element?.naturalWidth || image.width;
  const imageHeight = image.element?.naturalHeight || image.height;
  const crop = image.crop;

  if (!crop || !crop.width || !crop.height) {
    return {
      x: 0,
      y: 0,
      width: imageWidth,
      height: imageHeight,
    };
  }

  const x = clamp(Number(crop.x) || 0, 0, imageWidth - 1);
  const y = clamp(Number(crop.y) || 0, 0, imageHeight - 1);

  return {
    x,
    y,
    width: clamp(Number(crop.width) || imageWidth, 1, imageWidth - x),
    height: clamp(Number(crop.height) || imageHeight, 1, imageHeight - y),
  };
}

export function getContainedImageRect(source, target) {
  const sourceRatio = source.width / source.height;
  const targetRatio = target.width / target.height;
  let width = target.width;
  let height = target.height;

  if (sourceRatio > targetRatio) {
    height = width / sourceRatio;
  } else {
    width = height * sourceRatio;
  }

  return {
    x: target.x + (target.width - width) / 2,
    y: target.y + (target.height - height) / 2,
    width,
    height,
  };
}

function createMasonryItems(images, settings, dimensions, allowReorder) {
  const gap = getGap(settings, dimensions.width);
  const border = getBorder(settings, dimensions.width);
  const columnCount = images.length === 1 ? 1 : clamp(Math.round(Math.sqrt(images.length)), 2, 4);
  const columnWidth = (dimensions.width - gap * (columnCount + 1)) / columnCount;
  const scaledColumnWidth = columnWidth * getImageScale(settings);
  const columnHeights = Array(columnCount).fill(gap);
  const columnLastImages = Array(columnCount).fill(null);
  const remainingImages = [...images];
  const arrangedImages = [];
  const placements = [];
  let lastPlacedImage = null;

  while (remainingImages.length > 0) {
    const column = columnHeights.indexOf(Math.min(...columnHeights));
    const image = allowReorder
      ? takeBestMasonryImage(remainingImages, columnLastImages[column], lastPlacedImage)
      : remainingImages.shift();
    const imageHeight = scaledColumnWidth / getImageRatio(image);

    placements.push({
      x: gap + column * (columnWidth + gap) + (columnWidth - scaledColumnWidth) / 2,
      y: columnHeights[column],
      width: scaledColumnWidth,
      height: imageHeight,
    });

    columnHeights[column] += imageHeight + gap;
    columnLastImages[column] = image;
    lastPlacedImage = image;
    arrangedImages.push(image);
  }

  const contentHeight = Math.max(...columnHeights);
  const scale = contentHeight > dimensions.height ? (dimensions.height - gap) / contentHeight : 1;
  const scaledContentWidth = dimensions.width * scale;
  const xOffset = (dimensions.width - scaledContentWidth) / 2;
  const yOffset = contentHeight * scale < dimensions.height ? (dimensions.height - contentHeight * scale) / 2 : 0;

  return placements.map((placement, index) =>
    createLayoutItem(arrangedImages[index], {
      x: placement.x * scale + xOffset,
      y: placement.y * scale + yOffset,
      width: placement.width * scale,
      height: placement.height * scale,
      rotation: 0,
      border: border * scale,
      variant: 'photo',
    }),
  );
}

function createPolaroidItems(images, settings, dimensions) {
  const gap = getGap(settings, dimensions.width);
  const border = getBorder(settings, dimensions.width);
  const imageScale = getImageScale(settings);
  const columns = Math.ceil(Math.sqrt(images.length * (dimensions.width / dimensions.height)));
  const rows = Math.ceil(images.length / columns);
  const cellWidth = (dimensions.width - gap * (columns + 1)) / columns;
  const cellHeight = (dimensions.height - gap * (rows + 1)) / rows;

  return images.map((image, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const baseRect = getPolaroidSizedRect(image, cellWidth * imageScale, cellHeight * imageScale);

    return createLayoutItem(image, {
      x: gap + column * (cellWidth + gap) + (cellWidth - baseRect.width) / 2,
      y: gap + row * (cellHeight + gap) + (cellHeight - baseRect.height) / 2,
      width: baseRect.width,
      height: baseRect.height,
      rotation: (index % 2 === 0 ? -1 : 1) * (1.5 + (index % 3)),
      border,
      variant: 'polaroid',
    });
  });
}

function createScatteredItems(images, settings, dimensions, isPolaroid, randomize) {
  const border = getBorder(settings, dimensions.width);
  const placements = buildScatteredPlacements(
    images,
    dimensions.width,
    dimensions.height,
    isPolaroid,
    getImageScale(settings),
    randomize,
  );

  return placements.map((placement, index) => {
    const rect = isPolaroid ? getPolaroidSizedRect(images[index], placement.width, placement.height) : placement;

    return createLayoutItem(images[index], {
      x: placement.x - rect.width / 2,
      y: placement.y - rect.height / 2,
      width: rect.width,
      height: rect.height,
      rotation: placement.rotation,
      border,
      variant: isPolaroid ? 'polaroid' : 'photo',
    });
  });
}

function getPolaroidSizedRect(image, maxWidth, maxHeight) {
  const padding = Math.max(10, maxWidth * 0.055);
  const caption = Math.max(22, maxHeight * 0.12);
  const photoMaxWidth = Math.max(1, maxWidth - padding * 2);
  const photoMaxHeight = Math.max(1, maxHeight - padding * 2 - caption);
  const ratio = getImageRatio(image);
  let photoWidth = photoMaxWidth;
  let photoHeight = photoWidth / ratio;

  if (photoHeight > photoMaxHeight) {
    photoHeight = photoMaxHeight;
    photoWidth = photoHeight * ratio;
  }

  return {
    width: photoWidth + padding * 2,
    height: photoHeight + padding * 2 + caption,
  };
}

function createLayoutItem(image, placement) {
  return {
    image,
    imageId: image.id,
    name: image.name,
    ...placement,
  };
}

function takeBestMasonryImage(remainingImages, topNeighbor, leftNeighbor) {
  let chosenIndex = remainingImages.findIndex(
    (image) => !areVisuallySimilar(image, topNeighbor) && !areVisuallySimilar(image, leftNeighbor),
  );

  if (chosenIndex === -1) {
    chosenIndex = remainingImages.findIndex((image) => !areVisuallySimilar(image, topNeighbor));
  }

  if (chosenIndex === -1) {
    chosenIndex = 0;
  }

  return remainingImages.splice(chosenIndex, 1)[0];
}

function buildScatteredPlacements(images, width, height, hasPolaroidPadding, imageScale, randomize) {
  if (images.length === 1) {
    const ratio = getImageRatio(images[0]);
    const targetArea = width * height * (hasPolaroidPadding ? 0.42 : 0.5) * imageScale ** 2;
    const size = getScatteredFrameSize(targetArea, ratio, width, height, images.length, hasPolaroidPadding);

    return [
      {
        x: width / 2,
        y: height / 2,
        width: size.width,
        height: size.height,
        rotation: randomize ? randomBetween(-3, 3) : 0,
      },
    ];
  }

  const cells = randomize ? shuffleItems(buildCoverageCells(images.length, width, height)) : buildCoverageCells(images.length, width, height);
  const baseArea = (width * height) / Math.max(images.length, 2.6);
  const sizeMultiplier = hasPolaroidPadding ? 0.76 : 0.86;
  const placements = [];

  return images.map((image, index) => {
    const ratio = getImageRatio(image);
    const areaVariance = randomize ? randomBetween(0.82, 1.18) : 1;
    const targetArea = baseArea * areaVariance * sizeMultiplier * imageScale ** 2;
    const size = getScatteredFrameSize(targetArea, ratio, width, height, images.length, hasPolaroidPadding);
    const cell = cells[index % cells.length];
    const placement = chooseScatteredPlacement(cell, placements, size, width, height, randomize);

    placements.push(placement);
    return placement;
  });
}

function buildCoverageCells(count, width, height) {
  const columns = Math.ceil(Math.sqrt(count * (width / height)));
  const rows = Math.ceil(count / columns);
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const cells = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      cells.push({
        x: cellWidth * (column + 0.5),
        y: cellHeight * (row + 0.5),
        width: cellWidth,
        height: cellHeight,
      });
    }
  }

  return cells;
}

function getScatteredFrameSize(targetArea, ratio, width, height, count, hasPolaroidPadding) {
  let frameWidth = Math.sqrt(targetArea * ratio);
  let frameHeight = frameWidth / ratio;
  const maxWidth = width * (count <= 2 ? 0.62 : count <= 4 ? 0.46 : 0.34);
  const maxHeight = height * (count <= 2 ? 0.62 : count <= 4 ? 0.46 : 0.34);
  const minWidth = width * (hasPolaroidPadding ? 0.14 : 0.16);
  const minHeight = height * (hasPolaroidPadding ? 0.14 : 0.16);
  const maxAllowedScale = Math.min(maxWidth / frameWidth, maxHeight / frameHeight);
  const minUsefulScale = Math.max(1, Math.min(minWidth / frameWidth, minHeight / frameHeight));
  const scale = Math.min(maxAllowedScale, minUsefulScale);

  frameWidth *= scale;
  frameHeight *= scale;

  return { width: frameWidth, height: frameHeight };
}

function chooseScatteredPlacement(cell, existingPlacements, size, canvasWidth, canvasHeight, randomize) {
  let bestPlacement = null;
  let bestScore = Number.POSITIVE_INFINITY;
  const attempts = randomize ? 12 : 1;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const xJitter = randomize ? randomBetween(-cell.width * 0.34, cell.width * 0.34) : 0;
    const yJitter = randomize ? randomBetween(-cell.height * 0.34, cell.height * 0.34) : 0;
    const candidate = {
      x: clamp(
        cell.x + xJitter,
        size.width / 2,
        canvasWidth - size.width / 2,
      ),
      y: clamp(
        cell.y + yJitter,
        size.height / 2,
        canvasHeight - size.height / 2,
      ),
      width: size.width,
      height: size.height,
      rotation: randomize ? randomBetween(-9, 9) : 0,
    };
    const score = existingPlacements.reduce((total, placement) => total + getOverlapArea(candidate, placement), 0);

    if (score < bestScore) {
      bestPlacement = candidate;
      bestScore = score;
    }
  }

  return bestPlacement;
}

function getOverlapArea(firstRect, secondRect) {
  const firstLeft = firstRect.x - firstRect.width / 2;
  const firstRight = firstRect.x + firstRect.width / 2;
  const firstTop = firstRect.y - firstRect.height / 2;
  const firstBottom = firstRect.y + firstRect.height / 2;
  const secondLeft = secondRect.x - secondRect.width / 2;
  const secondRight = secondRect.x + secondRect.width / 2;
  const secondTop = secondRect.y - secondRect.height / 2;
  const secondBottom = secondRect.y + secondRect.height / 2;
  const overlapWidth = Math.max(0, Math.min(firstRight, secondRight) - Math.max(firstLeft, secondLeft));
  const overlapHeight = Math.max(0, Math.min(firstBottom, secondBottom) - Math.max(firstTop, secondTop));

  return overlapWidth * overlapHeight;
}

function getImageRatio(image) {
  const source = getSourceRect(image);
  return source.width / source.height || 1;
}

function getRatioBucket(image) {
  const ratio = getImageRatio(image);

  if (ratio < 0.82) {
    return 'portrait';
  }

  if (ratio > 1.22) {
    return 'landscape';
  }

  return 'square';
}

function getSizeBucket(image) {
  const source = getSourceRect(image);
  const area = source.width * source.height;

  if (area < 420000) {
    return 'small';
  }

  if (area > 1200000) {
    return 'large';
  }

  return 'medium';
}

function areVisuallySimilar(firstImage, secondImage) {
  if (!firstImage || !secondImage) {
    return false;
  }

  return getRatioBucket(firstImage) === getRatioBucket(secondImage) && getSizeBucket(firstImage) === getSizeBucket(secondImage);
}

function loadCanvasImage(projectImage) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ ...projectImage, element: image });
    image.onerror = reject;
    image.src = projectImage.dataUrl;
  });
}

function getGap(settings, width) {
  return Math.round((Number(settings.gapSpacing) || 0) * (width / 1600));
}

function getBorder(settings, width) {
  if (!settings.borderEnabled) {
    return 0;
  }

  return Math.max(1, Math.round((Number(settings.borderThickness) || 0) * (width / 1600)));
}

function getImageScale(settings) {
  return clamp((Number(settings.imageScale) || 100) / 100, 0.7, 1.45);
}
