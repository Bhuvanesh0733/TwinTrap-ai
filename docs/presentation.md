# Presentation Outline

A suggested slide structure for presenting TwinTrap AI. Each slide lists what to show and, where
relevant, which page/endpoint to demo live from instead of a static screenshot.

**Slide 1 — Title**
TwinTrap AI: Detecting and Explaining Digital-Twin Divergence Using Machine Learning.

**Slide 2 — What is a Digital Twin?**
Physical system → sensor telemetry → computational twin that predicts expected state. One diagram, one
sentence definition, no jargon.

**Slide 3 — Problem**
A twin can silently desynchronize (unmodeled physics, faults, operating-envelope shift). A wrong-but-
confident twin is worse than no twin. Can ML detect *and explain* that moment?

**Slide 4 — Paper A**
Title / authors / venue / year, 2–3 sentence summary, and its specific limitation. *(Placeholder until
`docs/research_gap.md` is filled in — do not present fabricated content.)*

**Slide 5 — Paper B**
Same structure as Slide 4.

**Slide 6 — Research Gap**
One or two sentences, following from A + B together, narrow and testable by this codebase.

**Slide 7 — Proposed TwinTrap Architecture**
The pipeline diagram: Simulation/Phone → Digital Twin → Discrepancy Features → ML Classification →
Probability / Severity / Fidelity → SHAP → Dashboard. Show that both demo modes share this shape.

**Slide 8 — Dataset**
Why a public dataset didn't fit (README §6), the physics-informed simulation, and the
SIMULATED/INJECTED-DRIFT labeling discipline. Live: **Dataset Explorer** page.

**Slide 9 — PCA Analysis**
PC1/PC2 scatter, explained variance. Live: **PCA/SVD/LDA Lab**.

**Slide 10 — SVD Analysis**
`np.linalg.svd` shapes and singular values, what U/Σ/Vᵀ mean. Live: same page.

**Slide 11 — ML Models**
Logistic Regression / Random Forest / XGBoost / MLP, and the model comparison table. Live: **Model Lab**.

**Slide 12 — Hyperparameter Tuning**
GridSearchCV vs RandomizedSearchCV, search space, best params, best CV score → test performance. Live:
**Model Lab** tuning panel (click "Run Grid Search" live if time allows).

**Slide 13 — ROC Analysis**
ROC curve, AUC, what it does and doesn't tell you. Live: **Evaluation**.

**Slide 14 — Precision-Recall Analysis**
PR curve, Average Precision, why it matters more under imbalance. Live: same page.

**Slide 15 — Imbalanced Dataset**
Balanced → 90:10 → 95:5 → 99:1 table and the auto-generated interpretation of which metric moved more.
Live: **Evaluation**, imbalance experiment section.

**Slide 16 — SHAP Explainability**
Global importance bar chart, one local explanation walked through in detail. Live: **Explainability**.

**Slide 17 — TwinTrap Demo (Industrial)**
Live: **Simulation** page — start the sim, inject a drift type, watch the **Dashboard** transition from
SYNCHRONIZED to a CRITICAL alert state in real time.

**Slide 17b — TwinTrap Demo (Smartphone)**
Live: **Smartphone Live Twin** + phone browser. Connect phone → Calibrate Twin → move the phone → inject
simulated drift → Explain Current Prediction. This is the "wow" slide for a non-ML audience — see
**Demo Mode** for the exact click-by-click script.

**Slide 18 — Results**
Best model, best metrics, what changed under imbalance, one headline SHAP finding — pull real numbers
from `backend/experiments/<run_id>/experiment.json`, never estimated.

**Slide 19 — Limitations / Ethics**
README §24 and §26 — simulated data, placeholder literature review, synthetic-archetype smartphone
model, statistical (not certified diagnostic) explanations.

**Slide 20 — Future Work**
README §25 — real paired telemetry validation, sequence models, expert-calibrated fidelity bands, native
mobile client.

**Slide 21 — Personal Reflection**
What was hardest (this is genuinely yours to write — e.g. designing a twin that's realistically
*imperfect* rather than a mirror of the real system; tuning the smartphone fidelity formula so healthy
noise doesn't read as drift).

**Slide 22 — Conclusion**
One sentence answering the research question with the actual result, one sentence on what's still open
(the literature gap, once finalized).
