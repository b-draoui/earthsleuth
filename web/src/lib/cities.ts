/**
 * Cities shown on the maps. Tier 1 is always visible; tier 2 appears when zoomed in.
 * side: where the name sits relative to its dot ('l' when a neighbour would overlap on the right).
 */
export interface City {
  name: string
  lat: number
  lon: number
  tier: 1 | 2
  side?: 'l' | 'r'
}

export const CITIES: City[] = [
  // tier 1
  { name: 'Lisbon', lat: 38.72, lon: -9.14, tier: 1 },
  { name: 'Madrid', lat: 40.42, lon: -3.7, tier: 1 },
  { name: 'Barcelona', lat: 41.39, lon: 2.17, tier: 1 },
  { name: 'Marseille', lat: 43.3, lon: 5.37, tier: 1 },
  { name: 'Milan', lat: 45.46, lon: 9.19, tier: 1 },
  { name: 'Rome', lat: 41.9, lon: 12.5, tier: 1 },
  { name: 'Belgrade', lat: 44.79, lon: 20.45, tier: 1 },
  { name: 'Bucharest', lat: 44.43, lon: 26.1, tier: 1 },
  { name: 'Sofia', lat: 42.7, lon: 23.32, tier: 1 },
  { name: 'Athens', lat: 37.98, lon: 23.73, tier: 1 },
  { name: 'Istanbul', lat: 41.01, lon: 28.98, tier: 1 },
  { name: 'Ankara', lat: 39.93, lon: 32.86, tier: 1 },
  { name: 'Beirut', lat: 33.89, lon: 35.5, tier: 1, side: 'l' },
  { name: 'Cairo', lat: 30.04, lon: 31.24, tier: 1 },
  { name: 'Tripoli', lat: 32.89, lon: 13.19, tier: 1 },
  { name: 'Tunis', lat: 36.81, lon: 10.18, tier: 1 },
  { name: 'Algiers', lat: 36.75, lon: 3.06, tier: 1 },
  { name: 'Rabat', lat: 34.02, lon: -6.84, tier: 1 },
  // tier 2
  { name: 'Porto', lat: 41.15, lon: -8.61, tier: 2 },
  { name: 'Seville', lat: 37.39, lon: -5.98, tier: 2 },
  { name: 'Valencia', lat: 39.47, lon: -0.38, tier: 2 },
  { name: 'Toulouse', lat: 43.6, lon: 1.44, tier: 2 },
  { name: 'Lyon', lat: 45.76, lon: 4.84, tier: 2 },
  { name: 'Venice', lat: 45.44, lon: 12.32, tier: 2 },
  { name: 'Zagreb', lat: 45.81, lon: 15.98, tier: 2 },
  { name: 'Sarajevo', lat: 43.86, lon: 18.41, tier: 2 },
  { name: 'Tirana', lat: 41.33, lon: 19.82, tier: 2 },
  { name: 'Naples', lat: 40.85, lon: 14.27, tier: 2 },
  { name: 'Palermo', lat: 38.12, lon: 13.36, tier: 2 },
  { name: 'Thessaloniki', lat: 40.64, lon: 22.94, tier: 2 },
  { name: 'Izmir', lat: 38.42, lon: 27.14, tier: 2 },
  { name: 'Adana', lat: 37.0, lon: 35.32, tier: 2 },
  { name: 'Aleppo', lat: 36.2, lon: 37.13, tier: 2 },
  { name: 'Nicosia', lat: 35.19, lon: 33.38, tier: 2, side: 'l' },
  { name: 'Damascus', lat: 33.51, lon: 36.29, tier: 2 },
  { name: 'Amman', lat: 31.95, lon: 35.93, tier: 2 },
  { name: 'Alexandria', lat: 31.2, lon: 29.92, tier: 2, side: 'l' },
  { name: 'Luxor', lat: 25.69, lon: 32.64, tier: 2 },
  { name: 'Benghazi', lat: 32.12, lon: 20.07, tier: 2 },
  { name: 'Sabha', lat: 27.04, lon: 14.43, tier: 2 },
  { name: 'Sfax', lat: 34.74, lon: 10.76, tier: 2 },
  { name: 'Ghardaïa', lat: 32.49, lon: 3.67, tier: 2 },
  { name: 'Oran', lat: 35.7, lon: -0.63, tier: 2 },
  { name: 'Fez', lat: 34.03, lon: -5.0, tier: 2 },
  { name: 'Casablanca', lat: 33.57, lon: -7.59, tier: 2, side: 'l' },
  { name: 'Marrakesh', lat: 31.63, lon: -7.98, tier: 2 },
  { name: 'Agadir', lat: 30.43, lon: -9.6, tier: 2 },
]

/** Zoom from which tier-2 cities appear. */
export const TIER2_ZOOM = 4.4

/** Closest city within ~1.5° of a point (distance corrected for latitude), or null. */
export function nearestCity(lat: number, lon: number, maxDeg = 1.5): City | null {
  let best: City | null = null
  let bestD = maxDeg
  const k = Math.cos((lat * Math.PI) / 180)
  for (const c of CITIES) {
    const d = Math.hypot(c.lat - lat, (c.lon - lon) * k)
    if (d < bestD) {
      bestD = d
      best = c
    }
  }
  return best
}
