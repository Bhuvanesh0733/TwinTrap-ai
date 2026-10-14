# Methodology

This document is the technical companion to the README — the exact equations, formulas, and thresholds
used throughout TwinTrap AI, for citation in a report or presentation.

## 1. Physical machine simulation

State variables: `load L ∈ [0,1]`, `rpm`, `torque`, `current`, `vibration`, `temperature`, `pressure`.
`L` follows a mean-reverting random walk toward a regime-dependent setpoint (`idle`, `normal`,
`high_load` — see `simulation/physics.py::PhysicsConfig.regimes`).

**Real machine** (non-linear, `simulation/machine.py`):

```
rpm         = RPM_BASE + RPM_GAIN·L + RPM_NL·L²                        + noise + fault
torque      = TORQUE_BASE + TORQUE_GAIN·L + TORQUE_NL·L³               + noise + fault
current     = CURRENT_BASE + CURRENT_GAIN·torque + CURRENT_NL·torque²/100 + noise + fault
vibration   = (VIB_BASE + VIB_RPM·(rpm/RPM_MAX)² + VIB_LOAD·L) · fault_mult + noise
temperature[t] = temperature[t-1] + dt·(HEAT_COEF·current² − COOL_COEF·(temperature[t-1] − T_AMBIENT))
                 + fault_heat_rate·dt + noise                    (first-order thermal integrator)
pressure    = PRESSURE_BASE + PRESSURE_LOAD·L + PRESSURE_TEMP·(temperature − T_AMBIENT) + noise + fault
```

**Digital Twin** (linearized, `simulation/twin.py`): identical structure with the `_NL` (non-linear)
terms removed and no fault terms — a twin, by construction, never observes fault channels. Its own
thermal integrator runs off its own (idealized) current estimate, not the real machine's.

All constants are in `PhysicsConfig` (`simulation/physics.py`), each with an inline comment on its
physical meaning and units.

## 2. Drift / fault model

Each injected fault is a `DriftEvent(drift_type, start_step, severity, profile, ramp_steps)`
(`simulation/drift.py`). Its magnitude at step `t`:

```
sudden:   m(t) = severity                                    for t ≥ start_step, else 0
gradual:  m(t) = severity · clip((t − start_step) / ramp_steps, 0, 1)
```

Fault magnitude is converted into a physical disturbance via `MAX_FAULT_EFFECT` (e.g.
`temperature_bias: 30°C`, `vibration_mult: 2.5×`, `rpm_bias: −350 rpm`, ...), applied to the **real**
machine's channel generation only.

**Labeling rule** (single source of truth, `physics.py::CFG.drift_label_threshold = 0.15`):

```
label = 1 (DRIFT)   iff   m(t) > 0.15   OR   operating regime ∉ {idle, normal}
label = 0 (HEALTHY) otherwise
```

This means a `gradual` episode contains both HEALTHY rows (early ramp, `m(t)` still small) and DRIFT
rows (once the threshold is crossed) — an intentional, documented design choice, not noise.

## 3. Discrepancy features (ML inputs)

For each of the 6 sensors `s`, computed every step in `simulation/simulator.py`:

```
abs_diff       = |real_s − twin_s|
rel_diff       = abs_diff / (|real_s| + ε)
pct_diff       = rel_diff × 100
rolling_diff   = mean(abs_diff over the last 10 steps)
velocity       = abs_diff[t] − abs_diff[t−1]
```

6 sensors × 5 features = **30 features**, the complete ML input vector (`simulation/simulator.py::feature_columns`).

## 4. Dataset construction & class imbalance

`simulation/dataset_generator.py::generate_pool` runs ~160 independent episodes (180 steps each; ~30%
stay fully healthy, ~70% get one of the 8 drift types injected at a random point with random severity and
ramp), concatenated into one pool DataFrame, every row tagged `source = "simulation"`.

`resample_to_ratio(pool, minority_ratio, n_total, seed)` draws a **stratified sample** from that pool to
hit an exact target ratio — `IMBALANCE_CONFIGS = {balanced: 0.50, moderate_90_10: 0.10, high_95_5: 0.05,
severe_99_1: 0.01}`. If a class has fewer rows available than requested, that class is bootstrapped
(sampled with replacement) and this is recorded in `.attrs`, never hidden.

## 5. Preprocessing

`ml/preprocessing.py::prepare_dataset`:

1. Drop rows with missing feature/label values; drop duplicate feature rows.
2. Stratified split: test (20%) held out first, then train/val split on the remainder (≈68% / 12% / 20%).
3. IQR outlier clipping (`iqr_mult = 3.0`, conservative), bounds **fit on train only**, applied to val/test.
4. `StandardScaler` **fit on train only**, applied (transform-only) to val/test.
5. Optional `class_weight="balanced"` (`sklearn.utils.class_weight.compute_class_weight`) or SMOTE
   (`imblearn.over_sampling.SMOTE`, applied to the scaled train split only, `k_neighbors` auto-reduced for
   small minority counts).

The test split is never touched by scaler fitting, outlier-bound fitting, SMOTE, or hyperparameter search.

## 6. PCA & SVD

`ml/pca_svd.py`. PCA via `sklearn.decomposition.PCA` (2 components for the scatter, up to 10 for the
explained-variance table). SVD via **explicit** `np.linalg.svd(X_scaled, full_matrices=False)`, reporting
`U.shape = (n_samples, k)`, `S.shape = (k,)`, `Vt.shape = (k, n_features)`, and
`explained_variance_ratio_i = S_i² / [(n−1) · Σ_j S_j²/(n−1)]`, cross-checked against sklearn's PCA
(`matches_pca`).

## 7. LDA

`ml/lda.py`. `sklearn.discriminant_analysis.LinearDiscriminantAnalysis(n_components=1)` (binary problem
→ exactly one discriminant axis). Reports the 1D projection per class and Fisher's separation ratio
`(mean_healthy − mean_drift)² / (var_healthy + var_drift)`.

## 8. Models & hyperparameter search spaces

| Model | Key config |
|---|---|
| Logistic Regression | `max_iter=2000`, optional `class_weight="balanced"` |
| Random Forest | `n_estimators=200, max_depth=8, min_samples_leaf=3` |
| XGBoost | `n_estimators=200, max_depth=4, learning_rate=0.1`, `scale_pos_weight` from class ratio |
| MLP | `hidden_layer_sizes=(64,32)`, `alpha=1e-4`, `early_stopping=True` |

Tuning grids (`ml/tuning.py`, 12 combinations each, `StratifiedKFold(3)`, scored on F1):

```
random_forest: n_estimators ∈ {100,200}, max_depth ∈ {4,8,12}, min_samples_leaf ∈ {1,3}
xgboost:       n_estimators ∈ {100,200}, max_depth ∈ {3,4,6}, learning_rate ∈ {0.05,0.1}
```

## 9. Twin Fidelity & severity (industrial)

```
normalized_i = min(|real_i − twin_i| / SCALE_i, 1.0)             SCALE = {temperature:25°C, vibration:3 mm/s,
TWIN FIDELITY (%) = 100 · (1 − mean_i normalized_i)                        rpm:300, current:8A, torque:15Nm, pressure:2bar}

severity(p):  p < 0.50 → HEALTHY | 0.50–0.65 → LOW | 0.65–0.80 → MEDIUM | 0.80–0.95 → HIGH | ≥0.95 → CRITICAL
              (p = ML-predicted drift probability; utils/fidelity.py::SEVERITY_THRESHOLDS)
```

## 10. Twin Fidelity & severity (smartphone)

```
z_k  = |observed_k − baseline_mean_k| / baseline_std_k             (per-channel, calibration-relative)
normalized_k = clip((z_k − FREE_ZONE_STD) / (FULL_LOSS_STD − FREE_ZONE_STD), 0, 1)
TWIN FIDELITY (%) = 100 · (1 − mean_k normalized_k)                  FREE_ZONE_STD=1.2, FULL_LOSS_STD=6.0

severity bands: fidelity ≥ 90 → SYNCHRONIZED | ≥70 → MINOR_DIVERGENCE | ≥40 → SIGNIFICANT_DIVERGENCE | else CRITICAL_DIVERGENCE
```

`FREE_ZONE_STD` exists because raw |Z| for Gaussian sensor noise already averages ≈0.8 — without a free
zone, a perfectly healthy stationary phone would be scored ~80% instead of ~97%. Verified empirically in
`backend/app/simulation/mobile_twin.py` development notes.

## 11. Smartphone Divergence Model

A `RandomForestClassifier(n_estimators=120, max_depth=6)` trained **immediately after each calibration**
on 1,200 synthetic samples: 600 "synchronized" (`N(baseline_mean, baseline_std)` per channel) and 600
"divergent" (one of the 5 documented archetypes — bias / spike / gradual / noise / multi_sensor — applied
as a std-relative offset from that *same* baseline). This is a per-session, statistically-grounded model,
not a claim of learning from real labeled drift incidents (`simulation/mobile_twin.py::_train_synthetic_divergence_model`).

## 12. Evaluation metrics

`evaluation/metrics.py`: `accuracy_score, precision_score, recall_score, f1_score, roc_auc_score,
average_precision_score, roc_curve, precision_recall_curve, confusion_matrix, classification_report` —
all from `sklearn.metrics`, computed on the held-out test split.

## 13. Imbalance experiment interpretation

`evaluation/imbalance_experiment.py::_build_interpretation` computes the numeric spread of ROC-AUC and
Average Precision across the four configurations and asserts `pr_more_informative_than_roc = (AP spread >
ROC-AUC spread)` — a real comparison of real numbers, not a scripted conclusion.
