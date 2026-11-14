"""Screens "Trend map" + "Opposite-trend map" (Doc 1, section 12).

- Pick a variable -> map, colour = slope per decade, dots = significant after FDR.
- Click a cell -> open its time series (Plotly scatter_map + st.plotly_chart(on_select="rerun")).
- Opposite-trend view: up / down / no change, next to the regional average chart.
- Colour-blind safe: blue = decrease, red/orange = increase for temperature;
  brown/green for water and vegetation. Also ↑ ↓ symbols and words.
"""

import streamlit as st

st.title("Trend map")
st.info("Under construction.")
