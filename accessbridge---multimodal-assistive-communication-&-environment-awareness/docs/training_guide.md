# Model Training & Reproducibility Guide

## 1. Controlled Experimental Protocol
All models are evaluated on the exact same held-out test split of 684 samples using identical source landmark features:

| Family | Architecture | Input Shape | Primary Hyperparameters |
| :--- | :--- | :--- | :--- |
| **Sequential** | Compact Transformer | `(32, 138)` | 3 Layers, 4 Heads, $d_{\text{model}}=128$, LR=1e-3 |
| **Sequential** | Bidirectional GRU | `(32, 138)` | 2 Layers, Hidden=96, Dropout=0.30 |
| **Sequential** | Bidirectional LSTM | `(32, 138)` | 2 Layers, Hidden=96, Dropout=0.35 |
| **Sequential** | 1D-CNN | `(32, 138)` | Convs: 64, 128, 128; AdaptiveAvgPool |
| **Classical** | Random Forest | `(291,)` | 150 Trees, max_depth=18, balanced weights |
| **Classical** | Support Vector Machine | `(291,)` | RBF Kernel, $C=10.0, \gamma=\text{'scale'}$ |

## 2. Running Local Training via CLI
```bash
# Activate virtual environment
source venv/bin/activate  # On Linux
venv\Scripts\activate     # On Windows

# Train Compact Transformer
python scripts/train.py --model transformer --epochs 50 --lr 0.001 --seed 42

# Train Classical Random Forest Baseline
python scripts/train.py --model rf --seed 42

# Quick 3-class smoke test verification
python scripts/train.py --model transformer --smoke-test
```

## 3. Google Colab Execution
For environments without local GPU acceleration, use the supplied notebooks in `notebooks/`:
1. Open `notebooks/04_sequence_model_training.ipynb` in Google Colab.
2. Mount Google Drive and download INCLUDE-50.
3. Train with GPU runtime in ~15 minutes.
4. Export the resulting checkpoint (`transformer_isl.pth`) to `artifacts/models/` and import via the web interface.
