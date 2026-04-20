"""Vertex AI Vector Search (Matching Engine) — upsert and query."""

from __future__ import annotations

import logging
from typing import Any

from google.api_core import exceptions as gexc
from google.cloud import aiplatform_v1

from config import settings

logger = logging.getLogger(__name__)


def _api_endpoint() -> str:
    loc = settings.VERTEX_AI_LOCATION
    return f"{loc}-aiplatform.googleapis.com"


def vector_search_configured() -> bool:
    return bool(
        settings.VERTEX_VECTOR_SEARCH_INDEX_ID
        and settings.VERTEX_VECTOR_SEARCH_INDEX_ENDPOINT_ID
        and settings.VERTEX_VECTOR_SEARCH_DEPLOYED_INDEX_ID
    )


def upsert_message_vector(datapoint_id: str, embedding: list[float], user_email: str) -> None:
    if not vector_search_configured():
        logger.debug("Vector Search not configured; skip upsert")
        return
    client = aiplatform_v1.IndexServiceClient(
        client_options={"api_endpoint": _api_endpoint()},
    )
    dp = aiplatform_v1.IndexDatapoint(
        datapoint_id=datapoint_id,
        feature_vector=embedding,
        restricts=[
            aiplatform_v1.IndexDatapoint.Restriction(
                namespace="user_email",
                allow_list=[user_email],
            )
        ],
    )
    request = aiplatform_v1.UpsertDatapointsRequest(
        index=settings.VERTEX_VECTOR_SEARCH_INDEX_ID,
        datapoints=[dp],
    )
    try:
        client.upsert_datapoints(request=request)
    except gexc.GoogleAPIError as exc:
        logger.warning("Vector Search upsert failed: %s", exc)


def find_similar_message_ids(
    query_embedding: list[float],
    neighbor_count: int,
    exclude_datapoint_ids: set[str] | None = None,
) -> list[dict[str, Any]]:
    """Return neighbors as list of {datapoint_id, distance}."""
    if not vector_search_configured():
        return []
    client = aiplatform_v1.MatchServiceClient(
        client_options={"api_endpoint": _api_endpoint()},
    )
    query_dp = aiplatform_v1.IndexDatapoint(
        datapoint_id="__query__",
        feature_vector=query_embedding,
    )
    q = aiplatform_v1.FindNeighborsRequest.Query(
        datapoint=query_dp,
        neighbor_count=max(neighbor_count * 4, neighbor_count + 5),
    )
    request = aiplatform_v1.FindNeighborsRequest(
        index_endpoint=settings.VERTEX_VECTOR_SEARCH_INDEX_ENDPOINT_ID,
        deployed_index_id=settings.VERTEX_VECTOR_SEARCH_DEPLOYED_INDEX_ID,
        queries=[q],
        return_full_datapoint=False,
    )
    try:
        response = client.find_neighbors(request)
    except gexc.GoogleAPIError as exc:
        logger.warning("Vector Search find_neighbors failed: %s", exc)
        return []

    out: list[dict[str, Any]] = []
    exclude = exclude_datapoint_ids or set()
    for nl in response.nearest_neighbors:
        for n in nl.neighbors:
            dp = n.datapoint
            did = str(dp.datapoint_id) if dp else ""
            if not did or did in exclude:
                continue
            dist = float(n.distance) if n.distance is not None else 0.0
            out.append({"datapoint_id": did, "distance": dist})
    return out
