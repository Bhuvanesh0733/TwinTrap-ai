from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class _NoProtectedNamespace(BaseModel):
    model_config = ConfigDict(protected_namespaces=())


class DriftInjectRequest(BaseModel):
    drift_type: str = Field(..., description="One of: gradual, sudden, temperature, vibration, rpm, multi_sensor, noise, operating_condition")
    severity: float = Field(1.0, ge=0.0, le=1.0)
    profile: Optional[str] = Field(None, description="'gradual' or 'sudden' (ignored for types that fix their own profile)")
    ramp_steps: int = Field(150, ge=1, le=2000)


class SimulationResetRequest(BaseModel):
    seed: Optional[int] = None


class DatasetRegenerateRequest(BaseModel):
    n_episodes: int = Field(160, ge=10, le=1000)
    episode_length: int = Field(180, ge=30, le=1000)
    seed: int = 42


class TrainRequest(_NoProtectedNamespace):
    dataset_name: str = "balanced"
    use_class_weight: bool = True
    balancing_strategy: str = Field("class_weight", description="'class_weight' | 'smote' | 'none'")


class TuneGridRequest(_NoProtectedNamespace):
    model_id: str = "random_forest"


class TuneRandomRequest(_NoProtectedNamespace):
    model_id: str = "random_forest"
    n_iter: int = Field(10, ge=2, le=50)


class ImbalanceExperimentRequest(_NoProtectedNamespace):
    model_id: str = "random_forest"


class ActiveModelRequest(_NoProtectedNamespace):
    model_id: str


class CrossValidationRequest(_NoProtectedNamespace):
    model_id: str = "random_forest"
    cv_folds: int = Field(5, ge=3, le=10)


class LearningCurveRequest(_NoProtectedNamespace):
    model_id: str = "random_forest"


# ------------------------------------------------------------ Smartphone --

class MobileDriftRequest(BaseModel):
    drift_type: str = Field(..., description="One of: bias, spike, gradual, noise, multi_sensor")
    severity: float = Field(0.7, ge=0.0, le=1.0)
    channel: Optional[str] = Field(None, description="Optional single channel to target, e.g. 'accel_x'")
    device_id: Optional[str] = None


class MobileCalibrateRequest(BaseModel):
    device_id: str
    duration_seconds: float = Field(6.0, ge=2.0, le=30.0)


class MobileResetRequest(BaseModel):
    device_id: Optional[str] = None
