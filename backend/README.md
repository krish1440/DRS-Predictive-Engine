---
title: DRS Predictive Engine
emoji: 🏏
colorFrom: purple
colorTo: blue
sdk: docker
pinned: false
---

# DRS AI Predictive Engine - Backend
This is the FastAPI backend for the AI-powered Cricket DRS Simulation.

### Tech Stack
- **FastAPI**: REST API
- **NumPy**: Linear Algebra & Triangulation
- **Custom MLP**: Neural Trajectory Inference

### Endpoints
- `POST /predict`: Receives 2D camera observations and returns a 3D triangulated & predicted trajectory.
