"""
AccessBridge - Bidirectional LSTM Model
Architecture: 2-Layer Bi-LSTM with Dropout and Linear Classifier
Input: (Batch, Sequence=32, Dim=138)
"""

import torch
import torch.nn as nn

class BiLSTMSignModel(nn.Module):
    def __init__(
        self,
        input_dim: int = 138,
        hidden_size: int = 96,
        num_layers: int = 2,
        num_classes: int = 50,
        dropout: float = 0.35
    ):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_dim,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            bidirectional=True,
            dropout=dropout if num_layers > 1 else 0.0
        )
        self.fc = nn.Sequential(
            nn.Linear(hidden_size * 2, 128),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(128, num_classes)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out, _ = self.lstm(x)
        pooled = out.mean(dim=1)
        logits = self.fc(pooled)
        return logits
