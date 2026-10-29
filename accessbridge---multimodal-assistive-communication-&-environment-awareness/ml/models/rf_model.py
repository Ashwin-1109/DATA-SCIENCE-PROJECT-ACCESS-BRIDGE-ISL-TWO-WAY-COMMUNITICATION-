"""
AccessBridge - Classical Baseline Models (Scikit-Learn)
1. Random Forest Classifier
2. Support Vector Machine (RBF Kernel)
Input: (Samples, Features=291)
"""

from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

def create_random_forest_model(n_estimators: int = 150, max_depth: int = 18, random_state: int = 42):
    return RandomForestClassifier(
        n_estimators=n_estimators,
        max_depth=max_depth,
        class_weight="balanced",
        n_jobs=-1,
        random_state=random_state
    )

def create_svm_model(C: float = 10.0, gamma: str = "scale", random_state: int = 42):
    return Pipeline([
        ("scaler", StandardScaler()),
        ("svm", SVC(
            C=C,
            kernel="rbf",
            gamma=gamma,
            probability=True,
            random_state=random_state
        ))
    ])
