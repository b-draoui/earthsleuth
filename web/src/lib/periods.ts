export const BEFORE = [2001, 2002, 2003, 2004, 2005]
export const AFTER = [2020, 2021, 2022, 2023, 2024]

export const BEFORE_LABEL = '2001–2005'
export const AFTER_LABEL = '2020–2024'

export function windowMean(time: string[], values: (number | null)[], years: number[]): number | null {
  let sum = 0
  let n = 0
  time.forEach((t, i) => {
    const v = values[i]
    if (v !== null && years.includes(Number(t.slice(0, 4)))) {
      sum += v
      n++
    }
  })
  return n ? sum / n : null
}
