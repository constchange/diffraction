export function imageDataToAmplitudeField(image, size) {
  if (!image?.data || image.width !== size || image.height !== size) {
    throw new TypeError("图片数据尺寸与物面采样尺寸不一致");
  }
  const amplitude = new Float32Array(size * size);
  const phase = new Float32Array(size * size);
  for (let index = 0; index < amplitude.length; index += 1) {
    const offset = index * 4;
    amplitude[index] = (
      image.data[offset] * 0.2126
      + image.data[offset + 1] * 0.7152
      + image.data[offset + 2] * 0.0722
    ) / 255;
  }
  return { amplitude, phase };
}
