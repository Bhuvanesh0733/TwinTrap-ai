// When accessed from localhost (desktop) talk directly to the FastAPI
// backend on :8000. When accessed from another device (phone via LAN or
// USB tethering) use the same host:port as the page so Vite's /api and
// /ws proxy rules forward traffic to the backend. This avoids the
// cross-port mixed-content block Chrome applies to whitelisted origins.
const isLocalhost =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (isLocalhost
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : `${window.location.protocol}//${window.location.host}`)

export const WS_BASE = API_BASE.replace(/^http/, 'ws')


class ApiError extends Error {
  constructor(message, status, detail) {
    super(message)
    this.status = status
    this.detail = detail
  }
}

async function request(path, { method = 'GET', body, params } = {}) {
  let url = `${API_BASE}${path}`
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
    ).toString()
    if (qs) url += `?${qs}`
  }
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  let data = null
  try {
    data = await res.json()
  } catch {
    /* no body */
  }
  if (!res.ok) {
    const detail = data?.detail || res.statusText
    throw new ApiError(typeof detail === 'string' ? detail : JSON.stringify(detail), res.status, detail)
  }
  return data
}

export const api = {
  // ---- health / research ----
  health: () => request('/api/health'),
  research: () => request('/api/research'),

  // ---- dataset ----
  datasetConfigs: () => request('/api/dataset/configs'),
  datasetSummary: (config) => request('/api/dataset/summary', { params: { config } }),
  datasetSample: (config, n) => request('/api/dataset/sample', { params: { config, n } }),
  featureStats: (config) => request('/api/dataset/feature-stats', { params: { config } }),
  regenerateDataset: (body) => request('/api/dataset/regenerate', { method: 'POST', body }),

  // ---- industrial simulation ----
  currentState: () => request('/api/current-state'),
  simHistory: (n) => request('/api/simulation/history', { params: { n } }),
  simStart: () => request('/api/simulation/start', { method: 'POST' }),
  simPause: () => request('/api/simulation/pause', { method: 'POST' }),
  simReset: (seed) => request('/api/simulation/reset', { method: 'POST', body: { seed } }),
  injectDrift: (body) => request('/api/simulation/drift', { method: 'POST', body }),
  clearDrift: () => request('/api/simulation/clear-drift', { method: 'POST' }),
  driftTypes: () => request('/api/simulation/drift-types'),

  // ---- models ----
  availableModels: () => request('/api/models/available'),
  train: (body) => request('/api/train', { method: 'POST', body }),
  modelComparison: () => request('/api/model-comparison'),
  setActiveModel: (model_id) => request('/api/models/set-active', { method: 'POST', body: { model_id } }),
  tuneGrid: (model_id) => request('/api/tune/grid', { method: 'POST', body: { model_id } }),
  tuneRandom: (model_id, n_iter) => request('/api/tune/random', { method: 'POST', body: { model_id, n_iter } }),
  tuningResults: () => request('/api/tuning-results'),
  crossValidate: (model_id, cv_folds) => request('/api/cross-validation', { method: 'POST', body: { model_id, cv_folds } }),
  learningCurve: (model_id) => request('/api/learning-curve', { method: 'POST', body: { model_id } }),
  featureImportance: (model_id) => request('/api/feature-importance', { params: { model_id } }),

  // ---- evaluation ----
  evaluation: (model_id) => request('/api/evaluation', { params: { model_id } }),
  imbalanceExperiment: (model_id, refresh) => request('/api/imbalance-experiment', { params: { model_id, refresh } }),

  // ---- analysis ----
  pca: (dataset) => request('/api/pca', { params: { dataset } }),
  svd: (dataset) => request('/api/svd', { params: { dataset } }),
  lda: (dataset) => request('/api/lda', { params: { dataset } }),

  // ---- explainability ----
  shapGlobal: (model_id) => request('/api/shap/global', { params: { model_id } }),
  shapSamples: (model_id, n) => request('/api/shap/samples', { params: { model_id, n } }),
  shapLocal: (sample_index, model_id) => request('/api/shap/local', { params: { sample_index, model_id } }),

  // ---- smartphone live twin ----
  mobileDevices: () => request('/api/mobile/devices'),
  mobileState: (device_id) => request('/api/mobile/state', { params: { device_id } }),
  mobileCalibrate: (device_id, duration_seconds) =>
    request('/api/mobile/calibrate', { method: 'POST', body: { device_id, duration_seconds } }),
  mobileCalibrateStatus: (device_id) => request('/api/mobile/calibrate/status', { params: { device_id } }),
  mobileDrift: (body) => request('/api/mobile/drift', { method: 'POST', body }),
  mobileClearDrift: (device_id) => request('/api/mobile/drift/clear', { method: 'POST', params: { device_id } }),
  mobileReset: (device_id) => request('/api/mobile/reset', { method: 'POST', body: { device_id } }),
  mobileShap: (device_id) => request('/api/mobile/shap', { params: { device_id } }),
}

export { API_BASE, ApiError }
