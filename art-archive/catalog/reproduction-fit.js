/** Preserve the full museum photograph, including irregular edges and historic mounts. */
export function reproductionFit(image, size, sourceAspect = image.widthPx / image.heightPx) {
  const ratio = size.width / size.height / sourceAspect;
  if (image.fit === 'contain') {
    return {width: size.width * Math.min(1, 1 / ratio), height: size.height * Math.min(1, ratio), u: 1, v: 1};
  }
  return {width: size.width, height: size.height, u: Math.min(1, ratio), v: Math.min(1, 1 / ratio)};
}
