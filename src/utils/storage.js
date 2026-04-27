const SETTINGS_KEY = 'collageStudio.settings';
const PROJECT_IMAGES_KEY = 'collageStudio.projectImages';

const defaultSettings = {
  aspectRatio: '1:1 Square',
  customWidth: 1200,
  customHeight: 1200,
  borderEnabled: true,
  borderThickness: 4,
  backgroundColor: '#f5f7fb',
  layoutStyle: 'Masonry',
  gapSpacing: 16,
  imageScale: 100,
  outputFormat: 'PNG',
};

function readJson(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    const parsed = stored ? JSON.parse(stored) : null;

    return isPlainObject(parsed) ? { ...fallback, ...parsed } : fallback;
  } catch (error) {
    console.warn(`Could not read ${key} from localStorage`, error);
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function readSessionJson(key, fallback) {
  try {
    const stored = sessionStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch (error) {
    console.warn(`Could not read ${key} from sessionStorage`, error);
    return fallback;
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function writeSessionJson(key, value) {
  sessionStorage.setItem(key, JSON.stringify(value));
}

export function getDefaultSettings() {
  return { ...defaultSettings };
}

export function loadStoredSettings() {
  return readJson(SETTINGS_KEY, getDefaultSettings());
}

export function saveStoredSettings(settings) {
  writeJson(SETTINGS_KEY, { ...getDefaultSettings(), ...settings });
}

export function loadProjectImages() {
  const images = readSessionJson(PROJECT_IMAGES_KEY, []);

  return Array.isArray(images) ? images : [];
}

export function saveProjectImages(images) {
  writeSessionJson(
    PROJECT_IMAGES_KEY,
    images.map(({ id, name, type, width, height, dataUrl, crop }) => ({
      id,
      name,
      type,
      width,
      height,
      dataUrl,
      crop,
    })),
  );
}

export function clearProjectImages() {
  sessionStorage.removeItem(PROJECT_IMAGES_KEY);
}
