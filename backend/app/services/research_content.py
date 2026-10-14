"""
research_content.py
=====================

STRICT RULE (spec section 2 / 27): no citations, authors, DOIs, years,
datasets, or "research gaps" are invented here. Every literature field
below is an explicit PLACEHOLDER until the student supplies two verified
papers (IEEE / Springer / arXiv) that actually motivate this project.

This module is the SINGLE SOURCE OF TRUTH for the Research / Case Study
page — edit the dictionary below once real papers are available; the
frontend and any exported docs pull from this same structure so nothing
drifts out of sync.
"""

RESEARCH_CASE_STUDY = {
    "research_question": (
        "Can a lightweight machine-learning system detect and explain Digital "
        "Twin divergence using sensor discrepancy features while maintaining "
        "reliable performance under class imbalance?"
    ),
    "sub_questions": [
        "Can ML distinguish healthy and drifted Digital Twin states?",
        "Which ML model performs best?",
        "Can PCA reveal separability between healthy and drifted states?",
        "What information is revealed through SVD?",
        "How do GridSearchCV and RandomizedSearchCV affect model performance?",
        "How does performance change under class imbalance?",
        "Is Precision-Recall more informative than ROC for rare drift events?",
        "Can SHAP explain which sensor discrepancies cause the model to classify a twin as drifted?",
        "Can the system detect different forms/severities of twin drift?",
    ],
    "paper_a": {
        "placeholder": True,
        "title": "PAPER_A",
        "authors": "PAPER_A_AUTHORS",
        "venue": "PAPER_A_VENUE (IEEE / Springer / arXiv)",
        "year": "PAPER_A_YEAR",
        "doi_or_url": "PAPER_A_DOI_OR_URL",
        "summary": "PAPER_A_SUMMARY — replace with a factual 2-4 sentence summary of the verified paper.",
        "limitation": "PAPER_A_LIMITATION — replace with the specific, verifiable limitation this paper itself reports or that follows directly from its stated method/results.",
    },
    "paper_b": {
        "placeholder": True,
        "title": "PAPER_B",
        "authors": "PAPER_B_AUTHORS",
        "venue": "PAPER_B_VENUE (IEEE / Springer / arXiv)",
        "year": "PAPER_B_YEAR",
        "doi_or_url": "PAPER_B_DOI_OR_URL",
        "summary": "PAPER_B_SUMMARY — replace with a factual 2-4 sentence summary of the verified paper.",
        "limitation": "PAPER_B_LIMITATION — replace with the specific, verifiable limitation this paper itself reports or that follows directly from its stated method/results.",
    },
    "final_research_gap": (
        "FINAL_RESEARCH_GAP — replace once Paper A and Paper B are verified. "
        "The gap must be NARROW and EXPERIMENTALLY TESTABLE by this codebase "
        "(e.g. tied to class-imbalance robustness, explainability of drift "
        "detectors, or multi-sensor discrepancy fusion) — not a generic claim "
        "such as 'no prior work has solved this'."
    ),
    "proposed_solution": (
        "TwinTrap AI proposes a lightweight discrepancy-feature-based drift "
        "classifier (Logistic Regression / Random Forest / XGBoost / MLP) "
        "trained on engineered real-vs-twin sensor discrepancy features "
        "(absolute, relative, percentage, rolling, and velocity differences "
        "across 6 channels), evaluated explicitly under controlled class "
        "imbalance (50:50 -> 99:1) using both ROC and Precision-Recall "
        "analysis, and explained per-prediction using SHAP. This is offered "
        "as a candidate solution to FINAL_RESEARCH_GAP and should be revised "
        "once that gap is finalized from verified literature."
    ),
    "methodology_summary": [
        "Simulate a coupled, non-linear physical machine and a simplified linear Digital Twin (see docs/methodology.md).",
        "Inject 8 controllable drift scenarios and label each timestep using a documented magnitude threshold.",
        "Engineer 30 discrepancy features (5 per sensor x 6 sensors) as ML inputs.",
        "Preprocess with leakage-safe train/val/test splitting, outlier clipping fit on train only, and StandardScaler.",
        "Analyze structure with PCA (2D projection + explained variance) and an explicit np.linalg.svd decomposition.",
        "Train and compare 4 classifiers; tune Random Forest / XGBoost with GridSearchCV and RandomizedSearchCV.",
        "Evaluate with Accuracy/Precision/Recall/F1/ROC-AUC/Average Precision, ROC and PR curves, and a confusion matrix.",
        "Repeat evaluation across Balanced/90:10/95:5/99:1 class ratios to study imbalance robustness.",
        "Explain predictions globally and locally with SHAP.",
    ],
    "limitations": [
        "The physical machine and its faults are SIMULATED, not measured from real hardware; absolute performance numbers should not be read as claims about real industrial deployments.",
        "The literature review is currently a placeholder — no research-gap claim in this project should be treated as validated until Paper A / Paper B are supplied and the gap section is completed.",
        "Class-imbalance experiments resample from one simulated pool; extreme ratios (99:1) may reuse minority-class rows across the train/test split boundary only within their own resampled dataset (each ratio still gets its own leakage-safe train/test split — see preprocessing.py), but the underlying physics diversity is bounded by the pool size.",
        "SHAP explanations describe the trained model's behaviour, not a claim about the true physical cause of any specific fault.",
    ],
    "future_work": [
        "Validate the discrepancy-feature approach against a real paired physical/twin telemetry stream if one becomes available.",
        "Extend drift types to include multi-step/compound fault sequences and gradual operating-condition rotation.",
        "Explore sequence models (e.g. LSTM/Temporal CNN) as an alternative to the current tabular-feature classifiers.",
        "Calibrate the Twin Fidelity Score against domain-expert-labeled severity bands rather than the current documented heuristic scale.",
    ],
    "ethical_considerations": [
        "This is a SIMULATED system; no claims are made about any specific real machine, vendor, or deployed digital twin.",
        "Automated drift/anomaly alerts in real industrial settings should support, not replace, qualified human judgement (especially for CRITICAL severity actions).",
        "Model outputs (probabilities, SHAP attributions) are statistical explanations of a fitted classifier, not certified diagnostic conclusions.",
    ],
}
