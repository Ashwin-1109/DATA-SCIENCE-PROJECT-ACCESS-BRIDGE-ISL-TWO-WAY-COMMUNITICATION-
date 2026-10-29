"""
AccessBridge - Phase 3 Exploratory Data Analysis (EDA) Generator
Reads data/manifests/include_greetings_manifest.csv, computes authentic summary
statistics, generates EDA distribution plots, and saves them to artifacts/eda/.
"""

import os
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from pathlib import Path

MANIFEST_PATH = Path("data/manifests/include_greetings_manifest.csv")
OUTPUT_DIR = Path("artifacts/eda")
REPORT_PATH = Path("data/reports/eda_report.md")

def main():
    print("=== Generating AccessBridge Dataset EDA ===")
    if not MANIFEST_PATH.exists():
        raise FileNotFoundError(f"Manifest not found at {MANIFEST_PATH}. Run build_manifest.py first.")
        
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    df = pd.read_csv(MANIFEST_PATH)
    print(f"Loaded manifest with {len(df)} samples across {df['class_name'].nunique()} classes.")
    
    # 1. Plot Class Distribution & Splits
    plt.figure(figsize=(10, 5), dpi=200)
    split_order = ["train", "val", "test"]
    palette = {"train": "#38BDF8", "val": "#34D399", "test": "#F472B6"}
    
    classes = sorted(df["class_name"].unique())
    bar_width = 0.25
    x_indices = np.arange(len(classes))
    
    for i, sp in enumerate(split_order):
        counts = [len(df[(df["class_name"] == c) & (df["split"] == sp)]) for c in classes]
        plt.bar(x_indices + (i - 1) * bar_width, counts, width=bar_width, label=sp.capitalize(), color=palette[sp])
        
    plt.xlabel("Gesture Class", fontweight="bold", fontsize=11)
    plt.ylabel("Sample Count", fontweight="bold", fontsize=11)
    plt.title("AccessBridge: Class Sample Counts by Stratified Split (INCLUDE-GREETING-SUBSET-v1)", fontweight="bold", fontsize=12)
    plt.xticks(x_indices, classes, rotation=15, ha="right", fontsize=10)
    plt.grid(axis="y", linestyle="--", alpha=0.3)
    plt.legend(title="Dataset Partition")
    plt.tight_layout()
    class_dist_plot = OUTPUT_DIR / "class_distribution.png"
    plt.savefig(class_dist_plot)
    plt.close()
    print(f"Saved: {class_dist_plot}")
    
    # 2. Plot Video Duration & Frame Count Distributions
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4.5), dpi=200)
    
    # Duration histogram
    ax1.hist(df["duration_seconds"], bins=15, color="#6366F1", edgecolor="#1E1B4B", alpha=0.85)
    ax1.set_xlabel("Duration (Seconds)", fontweight="bold", fontsize=10)
    ax1.set_ylabel("Video Count", fontweight="bold", fontsize=10)
    ax1.set_title("Clip Duration Distribution (s)", fontweight="bold", fontsize=11)
    ax1.axvline(df["duration_seconds"].mean(), color="#EF4444", linestyle="--", linewidth=2, label=f"Mean: {df['duration_seconds'].mean():.2f}s")
    ax1.axvline(df["duration_seconds"].median(), color="#F59E0B", linestyle=":", linewidth=2, label=f"Median: {df['duration_seconds'].median():.2f}s")
    ax1.grid(axis="y", linestyle="--", alpha=0.3)
    ax1.legend()
    
    # Frame count histogram
    ax2.hist(df["frame_count"], bins=15, color="#10B981", edgecolor="#064E3B", alpha=0.85)
    ax2.set_xlabel("Frame Count", fontweight="bold", fontsize=10)
    ax2.set_ylabel("Video Count", fontweight="bold", fontsize=10)
    ax2.set_title("Total Raw Video Frame Count", fontweight="bold", fontsize=11)
    ax2.axvline(df["frame_count"].mean(), color="#EF4444", linestyle="--", linewidth=2, label=f"Mean: {df['frame_count'].mean():.1f}f")
    ax2.axvline(df["frame_count"].median(), color="#F59E0B", linestyle=":", linewidth=2, label=f"Median: {df['frame_count'].median():.1f}f")
    ax2.grid(axis="y", linestyle="--", alpha=0.3)
    ax2.legend()
    
    plt.suptitle("AccessBridge: Video Duration and Frame Distribution", fontweight="bold", fontsize=13)
    plt.tight_layout()
    temporal_plot = OUTPUT_DIR / "duration_and_frames_distribution.png"
    plt.savefig(temporal_plot)
    plt.close()
    print(f"Saved: {temporal_plot}")
    
    # 3. File Size vs Duration Scatter Plot
    plt.figure(figsize=(8, 4.5), dpi=200)
    df["file_size_mb"] = df["file_size_bytes"] / (1024 * 1024)
    plt.scatter(df["duration_seconds"], df["file_size_mb"], color="#EC4899", edgecolors="#831843", alpha=0.75, s=50)
    plt.xlabel("Duration (seconds)", fontweight="bold", fontsize=10)
    plt.ylabel("File Size (MB)", fontweight="bold", fontsize=10)
    plt.title("Clip File Size (MB) vs Duration (Seconds)", fontweight="bold", fontsize=11)
    plt.grid(True, linestyle="--", alpha=0.3)
    plt.tight_layout()
    filesize_plot = OUTPUT_DIR / "filesize_vs_duration.png"
    plt.savefig(filesize_plot)
    plt.close()
    print(f"Saved: {filesize_plot}")
    
    # 4. Generate Comprehensive EDA Markdown Report
    eda_md = f"""# AccessBridge Exploratory Data Analysis (EDA) Report

**Target Dataset:** `INCLUDE-GREETING-SUBSET-v1`  
**Total Clips:** {len(df)}  
**Number of Classes:** {df['class_name'].nunique()}  
**Classes:** {', '.join(sorted(df['class_name'].unique()))}  

---

## 1. Summary Statistics

| Metric | Duration (s) | Raw Frame Count | File Size (MB) |
|:---|:---:|:---:|:---:|
| **Mean** | {df['duration_seconds'].mean():.2f}s | {df['frame_count'].mean():.1f} | {df['file_size_mb'].mean():.2f} MB |
| **Standard Deviation** | {df['duration_seconds'].std():.2f}s | {df['frame_count'].std():.1f} | {df['file_size_mb'].std():.2f} MB |
| **Median** | {df['duration_seconds'].median():.2f}s | {df['frame_count'].median():.1f} | {df['file_size_mb'].median():.2f} MB |
| **Minimum** | {df['duration_seconds'].min():.2f}s | {df['frame_count'].min()} | {df['file_size_mb'].min():.2f} MB |
| **Maximum** | {df['duration_seconds'].max():.2f}s | {df['frame_count'].max()} | {df['file_size_mb'].max():.2f} MB |

---

## 2. Partition Strategy

The dataset is partitioned using class-stratified splits (seed 42) into:
- **Train (70%):** {len(df[df['split']=='train'])} samples
- **Validation (15%):** {len(df[df['split']=='val'])} samples
- **Test (15%):** {len(df[df['split']=='test'])} samples

---

## 3. Preprocessing Implications for Feature Pipeline

1. **Variable Length to Fixed Length (32 frames):**
   Videos range from {df['duration_seconds'].min():.2f}s ({df['frame_count'].min()} frames) to {df['duration_seconds'].max():.2f}s ({df['frame_count'].max()} frames).
   Temporal linear resampling to a canonical 32 frames is mandatory to provide invariant tensor dimensions (32, 138) for sequence models.

2. **Spatial Normalization:**
   Mid-shoulder translation and inter-shoulder distance scaling normalize for signer distance and frame positioning across recordings.

3. **Hand Presence & Observation Masks:**
   One-handed signs (e.g. *Hello*, *Alright*) have missing non-dominant hand landmarks.
   Explicit observation masks ensure the neural network learns to recognize absent hands rather than confusing zero-coordinates with hands at the origin.
"""
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        f.write(eda_md)
        
    print(f"EDA Report saved to: {REPORT_PATH}")
    print("=== EDA Generation Complete ===")

if __name__ == "__main__":
    main()
