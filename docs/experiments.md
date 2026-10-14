# Experiments & Acceptance Checklist

## How experiments are recorded

Every `POST /api/train` call writes `backend/experiments/run_<YYYYMMDD_HHMMSS>/`:

```
run_20260925_092907/
├── scaler.joblib
├── model_logistic_regression.joblib
├── model_random_forest.joblib
├── model_xgboost.joblib
├── model_mlp_neural_net.joblib
└── experiment.json     # dataset config, balancing strategy, preprocessing summary, full metrics
```

Random seed `42` is used everywhere (data pool generation, train/val/test split, all model
`random_state`s, `StratifiedKFold`, SMOTE). Re-running the same configuration reproduces the same split
and near-identical metrics (models with internal stochastic optimization — MLP, and CV shuffling — vary
only within normal seeded-but-nondeterministic-solver tolerance).

## Suggested experiment log (fill in as you run them for your report)

| # | Dataset config | Balancing | Model | Accuracy | Precision | Recall | F1 | ROC-AUC | AP | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | balanced | class_weight | XGBoost | | | | | | | baseline |
| 2 | severe_99_1 | class_weight | Random Forest | | | | | | | |
| 3 | severe_99_1 | smote | Random Forest | | | | | | | compare vs #2 |
| 4 | balanced | class_weight | Random Forest (tuned, GridSearchCV) | | | | | | | |

Pull real numbers from the **Model Lab** and **Evaluation** pages (or `experiment.json`) — do not
estimate or fill in placeholder numbers here.

## Acceptance checklist — mapped to code / endpoint / page

| Requirement | Where it lives |
|---|---|
| No Streamlit | Whole repo — FastAPI + React only |
| React frontend works | `frontend/` — `npm run build` verified clean |
| FastAPI backend works | `backend/app/main.py` — verified via `/api/health` and full endpoint pass |
| Attractive responsive UI | Tailwind v4 dark industrial theme, `frontend/src/index.css` design tokens |
| Machine simulation | `simulation/machine.py` |
| Digital Twin simulation | `simulation/twin.py` |
| Healthy state | Default simulator state, no active drift |
| Gradual / Sudden drift | `simulation/drift.py` — `DriftEvent.profile` |
| Sensor-specific drift | `drift.py::DRIFT_CHANNELS` — temperature / vibration / rpm |
| Multi-sensor drift | `drift.py` — `multi_sensor` type |
| Twin Fidelity | `utils/fidelity.py::twin_fidelity` |
| Drift probability | `services/state.py::score_live_record`, ML `predict_proba` |
| Drift severity | `utils/fidelity.py::drift_severity` |
| Dataset explorer | `/api/dataset/*`, **Dataset Explorer** page |
| PCA implemented | `ml/pca_svd.py::run_pca`, **PCA/SVD/LDA Lab** page |
| PC1/PC2 scatter | `ScatterPlot` component, same page |
| SVD via `np.linalg.svd()` | `ml/pca_svd.py::run_svd` |
| U / Σ / Vᵀ shapes displayed | `/api/svd` response, `MatrixCard` component |
| Logistic Regression / Random Forest / XGBoost / MLP | `ml/classifiers.py` |
| Model comparison | `ml/train_pipeline.py::model_comparison_table`, **Model Lab** |
| GridSearchCV / RandomizedSearchCV | `ml/tuning.py`, **Model Lab** |
| `predict_proba` | Used throughout `evaluation/metrics.py`, `services/state.py` |
| ROC curve / ROC-AUC | `evaluation/metrics.py::roc_curve_data`, **Evaluation** page |
| Precision-Recall / Average Precision | `evaluation/metrics.py::pr_curve_data`, **Evaluation** page |
| Balanced / 90:10 / 95:5 / 99:1 | `simulation/dataset_generator.py::IMBALANCE_CONFIGS` |
| ROC vs PR comparison | `evaluation/imbalance_experiment.py::_build_interpretation` |
| SHAP | `ml/shap_explain.py`, **Explainability** page |
| Research section | `services/research_content.py`, **Research / Case Study** page |
| No fabricated research claims | `docs/research_gap.md` — explicit placeholders |
| No fabricated experimental results | Every number above traces to a live model / computed metric |
| README complete | `README.md` |
| Presentation outline | `docs/presentation.md` |
| **Cross-validation** | `ml/cross_validation.py`, **Model Lab** |
| **SMOTE** | `ml/preprocessing.py::apply_smote`, **Model Lab** balancing selector |
| **LDA** | `ml/lda.py`, **PCA/SVD/LDA Lab** |
| **Learning curves** | `ml/learning_curve.py`, **Model Lab** |
| **Feature importance (native, non-SHAP)** | `ml/feature_importance.py`, **Model Lab** |
| **Smartphone Live Twin mode** | `simulation/mobile_twin.py`, `api/mobile.py`, `/mobile` + `/smartphone` pages |
| **WebSocket phone streaming** | `POST/GET /api/mobile/*`, `WS /ws/mobile-sensor` |
| **Calibrate Twin** | `MobileTwinSession.start_calibration` / `_finish_calibration` |
| **Simulated drift injection (phone)** | `mobile_twin.py::_apply_drift_layer`, labeled `SIMULATED SENSOR DRIFT` |
| **Smartphone SHAP ("Explain Current Prediction")** | `GET /api/mobile/shap` |
| **Demo Mode** | `frontend/src/pages/DemoMode.jsx` |
| **Both modes use the same pipeline shape** | discrepancy → fidelity/severity → ML → SHAP, implemented separately per feature space but structurally identical (see README §21) |
