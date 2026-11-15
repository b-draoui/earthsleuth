/**
 * Every source used by EarthSleuth, in one place: the Conclude page and the downloaded report
 * both read it (Space Apps rule: credit every code, text and image source, even open source).
 */
export const CHALLENGE = {
  title: 'Be An Earth System Trend Detective!',
  event: 'NASA Space Apps Challenge 2026',
}

export const AI_USE =
  'AI tools used to build EarthSleuth: Claude (Anthropic) and ChatGPT (OpenAI). Where and how is detailed on the project page. ' +
  'Inside the app, the investigator (an AI agent, or a rule-based narrator until the agent is connected) plans investigations and ' +
  'writes explanations; every number it shows comes from the statistics engine. No image or video in the app is AI-generated.'

export const DATA: { name: string; by: string; doi: string }[] = [
  { name: 'MERRA-2 tavgM_2d_slv_Nx (M2TMNXSLV) v5.12.4: 2 m air temperature', by: 'NASA GMAO, distributed by GES DISC', doi: '10.5067/AP1B0BA5PD2K' },
  { name: 'GPM IMERG Final Precipitation L3 monthly (GPM_3IMERGM) V07: precipitation', by: 'NASA GPM, distributed by GES DISC', doi: '10.5067/GPM/IMERG/3B-MONTH/07' },
  { name: 'GLDAS Noah L4 monthly 0.25° (GLDAS_NOAH025_M) v2.1: soil moisture, evapotranspiration', by: 'Beaudoing & Rodell, NASA/GSFC/HSL, distributed by GES DISC', doi: '10.5067/SXAVCZFAQLNO' },
  { name: 'Terra MODIS Vegetation Indices monthly 0.05° (MOD13C2) v061: NDVI', by: 'NASA, distributed by LP DAAC', doi: '10.5067/MODIS/MOD13C2.061' },
]

export const MAPS = [
  'Natural Earth land, sea and borders, 1:50m and 1:110m (public domain), naturalearthdata.com',
  'Blue Marble Shaded Relief and Bathymetry, served by NASA GIBS (Global Imagery Browse Services, ESDIS)',
  'City positions: approximate coordinates of city centres, used only to place labels',
]

export const DESIGN = [
  'Fonts: Inter (Rasmus Andersson) and Space Grotesk (Florian Karsten), SIL Open Font License 1.1, via Fontsource',
  'Colours: ColorBrewer RdBu and BrBG diverging scales, Cynthia Brewer, colorbrewer2.org (Apache 2.0)',
  'Colours: Okabe–Ito colour-blind safe palette (Okabe & Ito, 2008)',
]

export const METHODS = [
  'Theil, H. (1950). A rank-invariant method of linear and polynomial regression analysis. Proc. KNAW 53.',
  "Sen, P. K. (1968). Estimates of the regression coefficient based on Kendall's tau. J. Am. Stat. Assoc. 63(324), 1379–1389.",
  'Mann, H. B. (1945). Nonparametric tests against trend. Econometrica 13(3), 245–259.',
  'Kendall, M. G. (1975). Rank Correlation Methods, 4th ed. Griffin, London.',
  'Hamed, K. H. & Rao, A. R. (1998). A modified Mann–Kendall trend test for autocorrelated data. J. Hydrology 204, 182–196.',
  'Benjamini, Y. & Hochberg, Y. (1995). Controlling the false discovery rate. J. R. Stat. Soc. B 57(1), 289–300.',
]

export const SOFTWARE: { group: string; items: [string, string][] }[] = [
  {
    group: 'Web app',
    items: [
      ['React', 'MIT'], ['React Router', 'MIT'], ['Vite', 'MIT'], ['TypeScript', 'Apache-2.0'], ['Tailwind CSS', 'MIT'],
      ['Motion', 'MIT'], ['MapLibre GL JS', 'BSD-3-Clause'], ['react-map-gl', 'MIT'], ['Recharts', 'MIT'],
      ['react-force-graph-2d', 'MIT'], ['Fontsource', 'OFL-1.1'], ['oxlint', 'MIT'],
    ],
  },
  {
    group: 'API and statistics',
    items: [
      ['FastAPI', 'MIT'], ['Uvicorn', 'BSD-3-Clause'], ['pandas', 'BSD-3-Clause'], ['NumPy', 'BSD-3-Clause'], ['SciPy', 'BSD-3-Clause'],
      ['xarray', 'Apache-2.0'], ['h5netcdf', 'BSD-3-Clause'], ['h5py', 'BSD-3-Clause'], ['PyArrow', 'Apache-2.0'],
      ['pyMannKendall', 'MIT'], ['statsmodels', 'BSD-3-Clause'], ['scikit-learn', 'BSD-3-Clause'], ['NetworkX', 'BSD-3-Clause'],
      ['PyYAML', 'MIT'], ['python-dotenv', 'BSD-3-Clause'], ['pytest', 'MIT'],
    ],
  },
  {
    group: 'Data pipeline and graph',
    items: [['earthaccess', 'MIT'], ['netCDF4', 'MIT'], ['pyhdf', 'MIT'], ['Neo4j Python driver', 'Apache-2.0']],
  },
]

export const HOSTING = 'Hosted on Render (free plan). Code on GitHub.'

/** The same credits as Markdown, for the downloaded report. */
export function creditsMarkdown(): string[] {
  return [
    '## Credits',
    '',
    `Challenge: "${CHALLENGE.title}", ${CHALLENGE.event}.`,
    '',
    '### Data (NASA)',
    ...DATA.map((d) => `- ${d.name}. ${d.by}. https://doi.org/${d.doi}`),
    '',
    '### Maps and imagery',
    ...MAPS.map((m) => `- ${m}`),
    '',
    '### Methods',
    ...METHODS.map((m) => `- ${m}`),
    '',
    '### Fonts and colours',
    ...DESIGN.map((m) => `- ${m}`),
    '',
    '### Open-source software',
    ...SOFTWARE.map((g) => `- ${g.group}: ${g.items.map(([n, l]) => `${n} (${l})`).join(', ')}`),
    '',
    '## Use of AI',
    '',
    AI_USE,
  ]
}
