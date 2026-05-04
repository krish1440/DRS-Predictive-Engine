import numpy as np

class DRSPredictor:
    def __init__(self):
        # Simulated "trained" weights for a trajectory prediction MLP
        # 10 points * 3 coordinates = 30 inputs
        self.W1 = np.random.randn(30, 32) * 0.01
        self.b1 = np.zeros(32)
        self.W2 = np.random.randn(32, 16) * 0.01
        self.b2 = np.zeros(16)
        self.W3 = np.random.randn(16, 3) * 0.01
        self.b3 = np.zeros(3)

    def relu(self, x):
        return np.maximum(0, x)

    def predict_next_step(self, recent_history):
        """
        Takes recent 10 tracking points (flattened to 30 values)
        Returns the predicted next position delta
        """
        if not recent_history:
            return np.array([0, 0, 0.1])
            
        # Flatten history for input
        x = np.array(recent_history).flatten()
        
        # Ensure x is exactly 30 elements
        if x.shape[0] != 30:
            # Pad or truncate to 30
            if x.shape[0] < 30:
                x = np.pad(x, (0, 30 - x.shape[0]), 'edge')
            else:
                x = x[:30]
                
        # Layer 1
        h1 = self.relu(np.dot(x, self.W1) + self.b1)
        # Layer 2
        h2 = self.relu(np.dot(h1, self.W2) + self.b2)
        # Output (Delta Prediction)
        delta = np.dot(h2, self.W3) + self.b3
        return delta

    def infer_trajectory(self, tracking_data, steps=120):
        """
        Predicts future trajectory by accurately capturing momentum from history.
        """
        if not tracking_data:
            return []
            
        future_path = []
        current_pos = np.array(tracking_data[-1])
        
        # Improved Velocity Estimation (Average over last 5 frames to avoid noise bias)
        if len(tracking_data) >= 5:
            velocities = [np.array(tracking_data[i]) - np.array(tracking_data[i-1]) for i in range(-4, 0)]
            v = np.mean(velocities, axis=0)
        elif len(tracking_data) >= 2:
            v = np.array(tracking_data[-1]) - np.array(tracking_data[-2])
        else:
            v = np.array([0, 0, 0.5])

        for _ in range(steps):
            history = (tracking_data + [p['position'] for p in future_path])[-10:]
            while len(history) < 10:
                history.insert(0, history[0])
            
            # Neural Delta (Reduced influence to avoid random bias)
            ai_delta = self.predict_next_step(history)
            
            v[1] -= 0.001 # Gravity
            
            # Use momentum + subtle AI refinement
            current_pos = current_pos + v + (ai_delta * 0.005)
            
            has_bounced = False
            if current_pos[1] < 0:
                v[1] *= -0.6
                current_pos[1] = 0
                has_bounced = True
            
            future_path.append({
                "position": current_pos.tolist(),
                "hasBounced": has_bounced
            })
            
            if current_pos[2] > 16: break
                
        return future_path

predictor = DRSPredictor()
