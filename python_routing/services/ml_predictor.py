"""
ML Flood Depth Predictor — Interface for Phase 3.

Currently a stub that returns None (no model loaded).
When a trained model is available at ML_MODEL_PATH, it will be loaded
and used to enhance flood depth predictions per edge.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger("ml_predictor")


class FloodPredictor:
    """Predict flood depth for each edge based on multi-source features."""

    def __init__(self, model_path: str | None = None) -> None:
        self.model = None
        self.model_version: str | None = None

        if model_path and Path(model_path).is_file():
            try:
                import joblib
                self.model = joblib.load(model_path)
                self.model_version = "v1.0"
                logger.info("ML flood model loaded from %s", model_path)
            except Exception as exc:
                logger.warning("Failed to load ML model from %s: %s", model_path, exc)

    def is_available(self) -> bool:
        """Check if a trained model is loaded."""
        return self.model is not None

    def predict_edge_depths(
        self,
        edges: list[dict],
        sensors: list[dict],
        flood_logs: list[dict],
        crowd_reports: list[dict]
    ) -> dict[int, float]:
        """
        Predict flood depth (cm) for each edge.

        Returns:
            {edge_id: predicted_depth_cm} or empty dict if model not available
        """
        if not self.is_available():
            return {}

        from ml.features import extract_features_for_edges
        
        try:
            X = extract_features_for_edges(edges, sensors, flood_logs, crowd_reports)
            y_pred = self.model.predict(X)
            
            predictions = {}
            for i, edge in enumerate(edges):
                predictions[edge['id']] = float(max(0.0, y_pred[i]))
                
            self._last_predictions_count = len(predictions)
            return predictions
        except Exception as exc:
            logger.error(f"Error predicting ML depths: {exc}", exc_info=True)
            return {}

    def get_prediction_info(self) -> dict | None:
        """Return metadata about the prediction for API response."""
        if not self.is_available():
            return None
        return {
            "model_version": self.model_version,
            "edges_with_predicted_flood": getattr(self, '_last_predictions_count', 0),
            "confidence": "medium",
        }


# Singleton
flood_predictor = FloodPredictor()


def init_predictor(model_path: str | None = None) -> FloodPredictor:
    """Initialize the global predictor with a model path."""
    if model_path and Path(model_path).is_file():
        try:
            import joblib
            flood_predictor.model = joblib.load(model_path)
            flood_predictor.model_version = "v1.0"
            logger.info("ML flood model loaded from %s", model_path)
        except Exception as exc:
            logger.warning("Failed to load ML model from %s: %s", model_path, exc)
    return flood_predictor
