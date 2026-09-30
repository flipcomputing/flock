import * as Blockly from 'blockly';
import { flock } from '../flock.js';
import { translate } from '../main/translation.js';
import { makeIconDataUrl, getCurrentIconColor, getWorkspaceAndFlyoutBlocks } from './blockIcons.js';

// Font Awesome Free 6.7.2 "camera" and "video" (solid) - https://fontawesome.com
// License - https://fontawesome.com/license/free
const ICONS = {
  CAPTURE_VIEW: {
    viewBox: '0 0 512 512',
    path: 'M149.1 64.8L138.7 96 64 96C28.7 96 0 124.7 0 160L0 416c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-256c0-35.3-28.7-64-64-64l-74.7 0L362.9 64.8C356.4 45.2 338.1 32 317.4 32L194.6 32c-20.7 0-39 13.2-45.5 32.8zM256 192a96 96 0 1 1 0 192 96 96 0 1 1 0-192z',
  },
  VIEW_CAMERA: {
    viewBox: '0 0 576 512',
    path: 'M0 128C0 92.7 28.7 64 64 64l256 0c35.3 0 64 28.7 64 64l0 256c0 35.3-28.7 64-64 64L64 448c-35.3 0-64-28.7-64-64L0 128zM559.2 101.8c10.4 5.6 16.8 16.4 16.8 28.2l0 256c0 11.8-6.5 22.6-16.8 28.2s-23 5-32.9-1.6l-96-64L416 337.1l0-17.1 0-128 0-17.1 14.2-9.5 96-64c9.8-6.5 22.4-7.2 32.9-1.6z',
  },
};
const FIELD_SIZE = 20;
const ACTIVE_OUTLINE_COLOUR = '#ffd400';

function makeIcon(name, color) {
  return makeIconDataUrl(ICONS[name].viewBox, ICONS[name].path, color);
}

export class FieldCaptureView extends Blockly.FieldImage {
  constructor() {
    super(
      makeIcon('CAPTURE_VIEW', getCurrentIconColor()),
      FIELD_SIZE,
      FIELD_SIZE,
      translate('capture_camera_view_label'),
      (field) =>
        import('../ui/gizmos.js').then((gizmos) =>
          gizmos.captureViewToCameraBlock(field.getSourceBlock())
        )
    );
  }

  static fromJson() {
    return new FieldCaptureView();
  }
}

export class FieldViewCamera extends Blockly.FieldImage {
  constructor() {
    super(
      makeIcon('VIEW_CAMERA', getCurrentIconColor()),
      FIELD_SIZE,
      FIELD_SIZE,
      translate('view_camera_label'),
      (field) =>
        import('../ui/gizmos.js').then((gizmos) =>
          gizmos.viewCameraForBlock(field.getSourceBlock())
        )
    );
  }

  static fromJson() {
    return new FieldViewCamera();
  }

  setActive(active) {
    if (!this.fieldGroup_) return;
    if (!this.activeOutline_) {
      this.activeOutline_ = Blockly.utils.dom.createSvgElement('rect', {
        x: -2,
        y: -2,
        width: FIELD_SIZE + 4,
        height: FIELD_SIZE + 4,
        rx: 4,
        fill: 'none',
        stroke: ACTIVE_OUTLINE_COLOUR,
        'stroke-width': 2,
      });
      this.fieldGroup_.insertBefore(this.activeOutline_, this.fieldGroup_.firstChild);
    }
    this.activeOutline_.style.display = active ? '' : 'none';
  }
}

Blockly.fieldRegistry.register('field_capture_view', FieldCaptureView);
Blockly.fieldRegistry.register('field_view_camera', FieldViewCamera);

flock._onCameraRigActiveChange = (frame, active) => {
  const block = Blockly.getMainWorkspace()?.getBlockById(frame.metadata?.blockKey);
  block?.getField('VIEW_CAMERA')?.setActive?.(active);
};

export function updateCameraButtonFieldIcons(workspace, iconColor) {
  if (!workspace) return;
  const captureUrl = makeIcon('CAPTURE_VIEW', iconColor);
  const viewUrl = makeIcon('VIEW_CAMERA', iconColor);
  for (const block of getWorkspaceAndFlyoutBlocks(workspace)) {
    block.getField?.('CAPTURE_VIEW')?.setValue(captureUrl);
    block.getField?.('VIEW_CAMERA')?.setValue(viewUrl);
  }
}
