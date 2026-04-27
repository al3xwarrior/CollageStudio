import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';

export function createCropModal(elements, callbacks) {
  let activeCropImageId = null;
  let cropper = null;

  function open(image) {
    if (!image) {
      return;
    }

    destroyCropper();
    activeCropImageId = image.id;
    elements.cropperImage.src = image.dataUrl;
    elements.cropperImage.alt = image.name;
    elements.cropModal.hidden = false;

    cropper = new Cropper(elements.cropperImage, {
      viewMode: 1,
      autoCropArea: 0.86,
      background: false,
      responsive: true,
      ready() {
        if (image.crop) {
          cropper.setData(image.crop);
        }
      },
    });
  }

  function close() {
    elements.cropModal.hidden = true;
    activeCropImageId = null;
    elements.cropperImage.removeAttribute('src');
    destroyCropper();
  }

  function apply() {
    if (!activeCropImageId || !cropper) {
      return;
    }

    callbacks.onApply(activeCropImageId, cropper.getData(true));
    close();
  }

  function setup() {
    elements.cancelCropButton.addEventListener('click', close);
    elements.modalCloseButton.addEventListener('click', close);
    elements.applyCropButton.addEventListener('click', apply);
    elements.cropModal.addEventListener('click', (event) => {
      if (event.target === elements.cropModal) {
        close();
      }
    });
  }

  function destroyCropper() {
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
  }

  return {
    open,
    close,
    setup,
  };
}
