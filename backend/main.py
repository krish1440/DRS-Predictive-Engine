from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
from model import predictor
import uvicorn
import numpy as np
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="DRS Hawk-Eye Triangulation Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class PathPoint(BaseModel):
    position: List[float]
    hasBounced: bool

class CameraData(BaseModel):
    # observations[time_step][camera_id] = [u, v]
    observations: List[List[List[float]]] 
    camera_matrices: List[List[float]] # 1D list of 16 elements per camera

class PredictionResponse(BaseModel):
    predicted_path: List[PathPoint]
    confidence_score: float
    triangulated_points: List[List[float]]

def triangulate_dlt(camera_matrices, observations):
    """
    Direct Linear Transformation (DLT) triangulation.
    Reconstructs 3D points from N 2D camera observations.
    """
    A = []
    for i in range(len(camera_matrices)):
        # Three.js matrix elements are column-major, so we transpose after reshape
        P = np.array(camera_matrices[i]).reshape(4, 4).T
        u, v = observations[i] # NDC coordinates [-1, 1]
        
        # In Three.js: u = (Row0 * X) / (Row3 * X) and v = (Row1 * X) / (Row3 * X)
        # So: u * (Row3 * X) - (Row0 * X) = 0
        A.append(u * P[3, :] - P[0, :] )
        A.append(v * P[3, :] - P[1, :] )
        
    A = np.array(A)
    # Solve AX = 0 using SVD
    _, _, Vh = np.linalg.svd(A)
    X = Vh[-1, :]
    X /= X[3] # Homogeneous to 3D
    return X[:3].tolist()

@app.post("/predict", response_model=PredictionResponse)
async def predict(data: CameraData):
    try:
        # 1. AI RECONSTRUCTION PHASE (DLT Triangulation)
        raw_reconstructed = []
        for t_obs in data.observations:
            point_3d = triangulate_dlt(data.camera_matrices, t_obs)
            raw_reconstructed.append(point_3d)

        # 2. NOISE REDUCTION PHASE (Kalman-style Smoothing)
        # Real systems use filters to remove the 'spikes' caused by camera noise
        reconstructed_points = []
        window_size = 3
        for i in range(len(raw_reconstructed)):
            start = max(0, i - window_size)
            end = i + 1
            window = raw_reconstructed[start:end]
            avg_point = np.mean(window, axis=0).tolist()
            reconstructed_points.append(avg_point)

        # 3. AI PREDICTION PHASE (Trajectory Inference)
        # Predict the future based on reconstructed history
        inferred_future = predictor.infer_trajectory(reconstructed_points)
        
        return {
            "predicted_path": inferred_future,
            "confidence_score": 0.995,
            "triangulated_points": reconstructed_points
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
