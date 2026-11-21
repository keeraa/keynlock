/** Apply one stamp to the appropriate damage layers. Pure orchestration keeps
 * the five tools testable independently of WebGL and canvas rendering. */
export const RESTORATION_TOOLS = new Set(['brush', 'swab', 'uv', 'reagent', 'retouch']);

export function applyRestorationStamp({ tool, x, y, width, height, strength, layers, erase, markUV, changed }) {
  const radius = Math.min(width, height);
  if (tool === 'brush') {
    erase(layers.dust, x, y, radius * .075, .82);
    erase(layers.dirt, x, y, radius * .062, .15);
    changed.add('dust');
    changed.add('dirt');
    return true;
  }
  if (tool === 'swab') {
    erase(layers.dirt, x, y, radius * .062, .16 + strength * .57);
    erase(layers.dust, x, y, radius * .062, .26);
    changed.add('dirt');
    changed.add('dust');
    return true;
  }
  if (tool === 'uv') {
    markUV(x, y);
    changed.add('uv');
    return true;
  }
  if (tool === 'reagent') {
    // Varnish responds only after UV marked the corresponding area.
    if (layers.scan.getImageData(Math.floor(x), Math.floor(y), 1, 1).data[3] < 10) return false;
    erase(layers.varnish, x, y, radius * .078, .41);
    erase(layers.cracks, x, y, radius * .078, .34);
    erase(layers.uvSource, x, y, radius * .078, .54);
    changed.add('varnish');
    changed.add('cracks');
    changed.add('uv');
    changed.add('uvSource');
    return true;
  }
  if (tool === 'retouch') {
    erase(layers.loss, x, y, radius * .029, .92);
    changed.add('loss');
    return true;
  }
  return false;
}
