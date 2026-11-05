// Sensors offered in the capture form. Researchers can type in others too.
// The keys match column names the interpretation engine already recognizes.

export interface SensorPreset {
  key: string;
  label: string;
  unit: string;
}

export const SENSOR_PRESETS: SensorPreset[] = [
  { key: "dissolved_oxygen_mgl", label: "Dissolved oxygen", unit: "mg/L" },
  { key: "water_temp_c", label: "Water temperature", unit: "°C" },
  { key: "pH", label: "pH", unit: "" },
  { key: "turbidity_ntu", label: "Turbidity", unit: "NTU" },
  { key: "conductivity_uscm", label: "Conductivity", unit: "µS/cm" },
  { key: "depth_m", label: "Depth", unit: "m" },
];

export const WEATHER_OPTIONS = [
  "Clear",
  "Partly cloudy",
  "Overcast",
  "Fog",
  "Light rain",
  "Heavy rain",
  "Snow",
  "Windy",
];

export function sensorLabel(key: string): string {
  return SENSOR_PRESETS.find((p) => p.key === key)?.label ?? key;
}
