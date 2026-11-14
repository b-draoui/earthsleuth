"""EarthSleuth entry page.

Run from the repo root:
    streamlit run app/Home.py

Screen "Home" (Doc 1, section 12): "What do you want to investigate?" box,
guided mode button, two demo investigations to watch.
"""

import streamlit as st

st.set_page_config(page_title="EarthSleuth", page_icon="🌍", layout="wide")

st.title("EarthSleuth")
st.caption("Is the Earth really changing here, or is it just luck?")

# TODO(app): 3-line description, question box, guided mode, two demo buttons,
#   short explanation of trends and significance, footer saying where AI was used.
st.info("Under construction.")
