"""
AccessBridge - 1D Temporal CNN Model
Architecture: Multi-scale 1D Temporal Convolutions with BatchNorm and Dropout
Input: (Batch, Sequence=32, Dim=138)
"""

import torch
import torch.nn as nn

class Conv1DSignModel(nn.Module):
    def __init__(
        self,
        input_dim: int = 138,
        num_classes: int = 50,
        dropout: float = 0.30
    ):
        super().__init__()
        # Conv1D expects shape (Batch, Channels/Dim, Length)
        self.block1 = nn.Sequential(
            nn.Conv1d(input_dim, 64, kernel_size=3, padding=1),
            nn.BatchNorm1d(64),
            nn.ReLU(),
            nn.Dropout(dropout)
        )
        self.block2 = nn.Sequential(
            nn.Conv1d(64, 128, kernel_size=5, padding=2),
            nn.BatchNorm1d(128),
            nn.ReLU(),
            nn.Dropout(dropout)
        )
        self.block3 = nn.Sequential(
            nn.Conv1d(128, 128, kernel_size=3, padding=1),
            nn.BatchNorm1d(128),
            nn.ReLU(),
            nn.Dropout(dropout)
        )
        self.global_pool = nn.AdaptiveAvgPool1d(1)
        self.classifier = nn.Sequential(
            nn.Linear(128, num_classes)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Transpose from (Batch, 32, 138) to (Batch, 138, 32)
        x = x.transpose(1, 2)
        x = self.block1(x)
        x = self.block2(x)
        x = self.block3(x)
        x = self.global_pool(x).squeeze(-1)
        logits = self.classifier(x)
        return logits
