export const DEFAULT_APERTURE_WIDTH_MM = 8;
export const SPATIAL_OBJECT_WIDTH_MM = 8;
export const SPATIAL_WAVELENGTH_NM = 532;
export const SPATIAL_FOCAL_LENGTH_M = 0.25;

const FRAUNHOFER_REFERENCE_WAVELENGTH_NM = 532;
const FRAUNHOFER_REFERENCE_FOCAL_LENGTH_M = 1.2;
const FRAUNHOFER_BASE_SAMPLING = 0.66;
const APERTURE_SAMPLES = 256;
const SPATIAL_FFT_SIZE = 512;
const SPATIAL_SPECTRUM_ZOOM = 1.45;

export function fraunhoferObservationWidthMm(
  zoom,
  apertureWidthMm = DEFAULT_APERTURE_WIDTH_MM,
) {
  if (!(zoom > 0) || !(apertureWidthMm > 0)) return 0;
  const wavelengthM = FRAUNHOFER_REFERENCE_WAVELENGTH_NM * 1e-9;
  const apertureWidthM = apertureWidthMm * 1e-3;
  return (
    wavelengthM
    * FRAUNHOFER_REFERENCE_FOCAL_LENGTH_M
    * FRAUNHOFER_BASE_SAMPLING
    * APERTURE_SAMPLES
    / apertureWidthM
    / zoom
  ) * 1e3;
}

export function spatialSpectrumWidthPerMm(
  objectWidthMm = SPATIAL_OBJECT_WIDTH_MM,
) {
  if (!(objectWidthMm > 0)) return 0;
  const objectPitchMm = objectWidthMm / APERTURE_SAMPLES;
  const frequencyStepPerMm = 1 / (SPATIAL_FFT_SIZE * objectPitchMm);
  const visibleFftSamples = SPATIAL_FFT_SIZE * FRAUNHOFER_BASE_SAMPLING / SPATIAL_SPECTRUM_ZOOM;
  return visibleFftSamples * frequencyStepPerMm;
}

export function niceScaleBar(totalWidth, targetFraction = 0.25) {
  if (!(totalWidth > 0) || !(targetFraction > 0)) return 0;
  const target = totalWidth * targetFraction;
  const exponent = 10 ** Math.floor(Math.log10(target));
  const normalized = target / exponent;
  const step = normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1;
  return step * exponent;
}

export function coordinateUnitLatex(unit) {
  if (["mm⁻¹", "mm^-1", "inverse-mm"].includes(unit)) {
    return String.raw`\mathrm{mm}^{-1}`;
  }
  if (unit === "mm") return String.raw`\mathrm{mm}`;
  return String.raw`\mathrm{${String(unit ?? "").replace(/[^a-zA-Z]/g, "")}}`;
}

export function coordinateScaleLatex(value, unit) {
  const formattedValue = Number.isInteger(value)
    ? String(value)
    : Number(value).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  const formattedUnit = coordinateUnitLatex(unit);
  return ["mm⁻¹", "mm^-1", "inverse-mm"].includes(unit)
    ? String.raw`${formattedValue}\,(${formattedUnit})`
    : String.raw`${formattedValue}\,${formattedUnit}`;
}
