"""Screens "Plan" + "Live progress" (Doc 1, section 12).

- The investigation plan in simple words: variables (with definitions), datasets, region,
  period, methods. The user can edit it.
- Each agent step lights up as it runs ("Downloading GLDAS 2001–2024…"): loop over
  data_access.run_investigation() / replay_demo() events inside st.status.
- The answer, each part labelled observed / literature / hypothesis.
"""

import streamlit as st

st.title("Ask a question")
st.info("Under construction.")
