"""Plain-language text the app shows next to the data: definitions, not findings."""

DEFINITIONS = {
    "t2m": "How warm the air is 2 metres above the ground, the height of a weather-station thermometer.",
    "precip": "How much rain (or snow, counted as water) falls in a month, in millimetres.",
    "soil_moisture": "How much water the top 10 cm of soil holds: the layer seeds and shallow roots drink from.",
    "et": "Water going back to the air from soil, lakes and plant leaves each day. The land breathing out.",
    "ndvi": "A satellite index of how green and dense plants are: about 0 for bare desert, close to 1 for thick forest.",
}

WHY_IT_MATTERS = {
    "t2m": "Heat drives everything else: it pulls water out of soils and plants.",
    "precip": "The only water input for most farms and aquifers in the region.",
    "soil_moisture": "Where water is actually available to crops and natural vegetation.",
    "et": "Shows whether the land is limited by energy (too cold) or by water (too dry).",
    "ndvi": "The visible result: are landscapes greening or browning?",
}

METHOD = "anomalies; Theil-Sen; MK Hamed-Rao; BH-FDR q=0.10; cos-lat weights"
