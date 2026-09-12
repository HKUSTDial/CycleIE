"""RoBERTa sentence embeddings used by the FAISS vector index."""

import logging
from typing import List

import torch
from langchain.embeddings.base import Embeddings
from transformers import AutoModel, AutoTokenizer

logger = logging.getLogger(__name__)

DEFAULT_MODEL_NAME = "sentence-transformers/all-roberta-large-v1"
MAX_SEQUENCE_LENGTH = 512


class RobertaEmbeddings(Embeddings):
    """Mean-pooled RoBERTa embeddings with a LangChain-compatible interface."""

    def __init__(self, model_name: str = DEFAULT_MODEL_NAME, device: str = None, batch_size: int = 16):
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.batch_size = batch_size
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModel.from_pretrained(model_name).to(self.device)
        self.model.eval()
        logger.info("Loaded %s on %s", model_name, self.device)

    def _encode(self, texts: List[str]) -> List[List[float]]:
        embeddings = []
        for start in range(0, len(texts), self.batch_size):
            batch = texts[start:start + self.batch_size]
            encoded = self.tokenizer(
                batch,
                padding=True,
                truncation=True,
                max_length=MAX_SEQUENCE_LENGTH,
                return_tensors="pt",
            ).to(self.device)

            with torch.no_grad():
                hidden = self.model(**encoded).last_hidden_state

            # Mean pooling over non-padding tokens.
            mask = encoded["attention_mask"].unsqueeze(-1).expand(hidden.size()).float()
            pooled = (hidden * mask).sum(dim=1) / mask.sum(dim=1).clamp(min=1e-9)
            embeddings.extend(pooled.cpu().tolist())
        return embeddings

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return self._encode(texts)

    def embed_query(self, text: str) -> List[float]:
        return self._encode([text])[0]
