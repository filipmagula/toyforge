import type { SceneHandle } from './scene';

/** Renders the current view and returns a PNG no larger than max×max. */
export function captureThumbnail(handle: SceneHandle, max = 512): Promise<Blob> {
  handle.render();
  const src = handle.renderer.domElement;
  const scale = Math.min(1, max / Math.max(src.width, src.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(src.width * scale));
  canvas.height = Math.max(1, Math.round(src.height * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#e0f2fe';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('thumbnail failed'))), 'image/png'));
}
