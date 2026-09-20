export type VehicleText = { description: string | null; features: string[] };
export type VehicleTranslation = { description: string | null; features: unknown } | null;

/** The translated description and features where they exist; English fills any gap, field by field. */
export function localizedVehicleText(base: VehicleText, translation: VehicleTranslation): VehicleText {
  if (!translation) return base;
  const features = Array.isArray(translation.features) && translation.features.every((f) => typeof f === "string") && translation.features.length > 0
    ? (translation.features as string[])
    : base.features;
  return { description: translation.description?.trim() ? translation.description : base.description, features };
}
