#!/usr/bin/env python3
"""
AccessBridge - CLI Model Training Script
Trains SVM, Random Forest, 1D-CNN, LSTM, GRU, or Compact Transformer on the processed dataset.
"""

import argparse
import sys
import os
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from ml.training.train_runner import run_model_training

def main():
    parser = argparse.ArgumentParser(description="Train ISL recognition models for AccessBridge")
    parser.add_argument("--model", choices=["transformer", "gru", "lstm", "cnn1d", "rf", "svm"], default="cnn1d")
    parser.add_argument("--epochs", type=int, default=25)
    parser.add_argument("--lr", type=float, default=0.001)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--smoke-test", action="store_true", help="Run quick smoke test")
    args = parser.parse_args()

    print(f"\n========================================================")
    print(f" AccessBridge - Real Model Training: {args.model.upper()}")
    print(f" Epochs: {args.epochs} | LR: {args.lr} | Seed: {args.seed} | SmokeTest: {args.smoke_test}")
    print(f"========================================================\n")

    def progress_callback(epoch, total_ep, loss, val_acc, pct):
        print(f" [Epoch {epoch:02d}/{total_ep:02d}] Loss: {loss:.4f} | Val Accuracy: {val_acc*100:.1f}% | Progress: {pct:.0f}%")

    result = run_model_training(
        model_type=args.model,
        epochs=args.epochs,
        lr=args.lr,
        seed=args.seed,
        is_smoke_test=args.smoke_test,
        callback=progress_callback
    )

    print("\n--------------------------------------------------------")
    print(f" Training Complete!")
    print(f" Model: {result.get('display_name')}")
    print(f" Checkpoint: {result.get('checkpoint_path')}")
    print(f" Best Validation Accuracy: {result.get('val_accuracy')*100:.2f}%")
    print(f" Active model registered in active_model_config.json")
    print("--------------------------------------------------------\n")

if __name__ == "__main__":
    main()
