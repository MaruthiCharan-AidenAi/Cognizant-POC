"""Vertex AI text embeddings."""

from __future__ import annotations

import logging
from typing import Any

import vertexai
from google import genai
from google.genai import types as genai_types
from vertexai.language_models import TextEmbeddingModel

from config import settings

logger = logging.getLogger(__name__)

_model: TextEmbeddingModel | None = None
_genai_client: genai.Client | None = None


def _get_model() -> TextEmbeddingModel:
    global _model
    if _model is None:
        vertexai.init(project=settings.GCP_PROJECT_ID, location=settings.VERTEX_AI_LOCATION)
        _model = TextEmbeddingModel.from_pretrained(settings.VERTEX_EMBEDDING_MODEL)
        logger.info("Vertex embedding model loaded: %s", settings.VERTEX_EMBEDDING_MODEL)
    return _model


def _get_genai_client() -> genai.Client:
    global _genai_client
    if _genai_client is None:
        _genai_client = genai.Client(
            vertexai=True,
            project=settings.GCP_PROJECT_ID,
            location=settings.VERTEX_AI_LOCATION,
        )
    return _genai_client


def _embed_with_genai(texts: list[str]) -> list[list[float]]:
    client = _get_genai_client()
    response = client.models.embed_content(
        model=settings.VERTEX_EMBEDDING_MODEL,
        contents=texts,
        config=genai_types.EmbedContentConfig(
            output_dimensionality=settings.VERTEX_EMBEDDING_DIMENSIONS,
        ),
    )
    embeddings = getattr(response, "embeddings", None) or []
    vectors: list[list[float]] = []
    for emb in embeddings:
        vals: Any = getattr(emb, "values", None)
        if vals is None:
            vals = emb.get("values") if isinstance(emb, dict) else None
        if vals is None:
            raise RuntimeError("Embedding response missing vector values.")
        vectors.append([float(v) for v in vals])
    return vectors


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Return embedding vectors for each non-empty text (same order)."""
    if not texts:
        return []
    model_name = settings.VERTEX_EMBEDDING_MODEL.strip()
    if model_name.startswith("gemini-embedding-"):
        return _embed_with_genai(texts)
    model = _get_model()
    embeddings = model.get_embeddings(texts)
    return [list(e.values) for e in embeddings]


def embed_text(text: str) -> list[float]:
    return embed_texts([text])[0]
