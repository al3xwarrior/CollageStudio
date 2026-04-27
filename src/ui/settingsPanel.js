import { loadStoredSettings, saveStoredSettings } from '../utils/storage.js';

export function createSettingsPanel(elements, onSettingsChange) {
  function getSettings() {
    const formData = new FormData(elements.settingsForm);

    return {
      aspectRatio: formData.get('aspectRatio'),
      customWidth: Number(formData.get('customWidth')) || 1200,
      customHeight: Number(formData.get('customHeight')) || 1200,
      borderEnabled: formData.get('borderEnabled') === 'on',
      borderThickness: Number(formData.get('borderThickness')) || 4,
      backgroundColor: formData.get('backgroundColor') || '#f5f7fb',
      layoutStyle: formData.get('layoutStyle'),
      gapSpacing: Number(formData.get('gapSpacing')) || 0,
      imageScale: Number(formData.get('imageScale')) || 100,
      outputFormat: formData.get('outputFormat'),
    };
  }

  function load() {
    const settings = loadStoredSettings();

    elements.settingsForm.elements.aspectRatio.value = settings.aspectRatio;
    elements.settingsForm.elements.customWidth.value = settings.customWidth;
    elements.settingsForm.elements.customHeight.value = settings.customHeight;
    elements.settingsForm.elements.borderEnabled.checked = settings.borderEnabled;
    elements.settingsForm.elements.borderThickness.value = settings.borderThickness;
    elements.settingsForm.elements.backgroundColor.value = settings.backgroundColor;
    elements.settingsForm.elements.layoutStyle.value = settings.layoutStyle;
    elements.settingsForm.elements.gapSpacing.value = settings.gapSpacing;
    elements.settingsForm.elements.imageScale.value = settings.imageScale;
    elements.settingsForm.elements.outputFormat.value = settings.outputFormat;
    updateCustomSizeVisibility();
    updateImageScaleLabel();
  }

  function save(settings = getSettings()) {
    saveStoredSettings(settings);
  }

  function updateCustomSizeVisibility() {
    elements.customSizeRow.classList.toggle('is-visible', elements.aspectRatioSelect.value === 'Custom');
  }

  function updateImageScaleLabel() {
    elements.imageScaleValue.textContent = `${elements.settingsForm.elements.imageScale.value}%`;
  }

  function handleChange() {
    const settings = getSettings();
    save(settings);
    onSettingsChange(settings);
  }

  function setup() {
    elements.settingsForm.addEventListener('change', () => {
      updateCustomSizeVisibility();
      handleChange();
    });
    elements.settingsForm.addEventListener('input', () => {
      updateImageScaleLabel();
      handleChange();
    });
  }

  return {
    getSettings,
    load,
    save,
    setup,
  };
}
