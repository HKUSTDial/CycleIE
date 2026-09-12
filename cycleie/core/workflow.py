"""Entry points that run CycleIE over a set of documents."""

import logging
import os
import queue
import threading
import time
from typing import Callable, Dict, Iterator, List, Optional

from ..agents.controller import WorkflowController
from ..llm import get_llm_response, set_model
from .document_manager import DocumentManager
from .state import TEMPORARY_TAG, CycleIEState

logger = logging.getLogger(__name__)

STREAM_POLL_SECONDS = 0.05
FINAL_ANSWER_MARKER = "FINAL ANSWER:"

NO_DOCUMENT_PROMPT = """Please answer the following question based on your own knowledge. The user has not
selected any reference documents, so rely on your own knowledge, and mention that selecting the relevant
documents and asking again would give a document-grounded answer.

Question: {query}
"""

DIRECT_QA_PROMPT = """Answer the user's question from the documents below. Give a direct, accurate and
detailed answer.
{history}
Documents:
{documents}

Question: {query}
"""

DIRECT_QA_NO_DOCUMENT_PROMPT = """Answer the user's question from your own knowledge; no documents are
available.
{history}
Question: {query}
"""


def _prepare(
    documents: List[str],
    doc_mode: str,
    custom_params: Optional[Dict],
) -> DocumentManager:
    """Return a document manager with the documents loaded and indexed."""
    custom_params = dict(custom_params or {})
    doc_manager = custom_params.pop("doc_manager", None)
    preloaded = doc_manager is not None
    if doc_manager is None:
        doc_manager = DocumentManager(**custom_params)

    if doc_mode != "paths":
        return doc_manager

    chunks = doc_manager.load_documents(documents)
    if not chunks:
        raise ValueError("Could not load any document. Check the paths and formats.")

    if preloaded or doc_manager.load_faiss_index():
        doc_manager.add_documents(chunks)
    else:
        doc_manager.index_documents(chunks)
    return doc_manager


def _conversation_history(chat_context: Optional[List[str]]) -> str:
    if not chat_context:
        return ""
    return "\nEarlier turns of this conversation:\n" + "\n".join(chat_context) + "\n"


def stream_direct_qa(
    query: str,
    documents: List[str] = None,
    doc_manager: Optional[DocumentManager] = None,
    model: str = None,
    chat_context: Optional[List[str]] = None,
) -> Iterator[str]:
    """One-pass baseline: read the documents in full and answer in a single call.

    This is the one-pass extraction that CycleIE is compared against, and the
    mode the web application falls back to when the loop is switched off. The
    documents are read whole rather than retrieved, so it has no index and no
    verification.
    """
    if model:
        set_model(model)

    contents = []
    if documents and doc_manager:
        yield f"{TEMPORARY_TAG} Loading the documents..."
        for path in documents:
            try:
                content = doc_manager.load_document_content(path)
            except (FileNotFoundError, ValueError, OSError) as error:
                logger.error("Could not load %s: %s", path, error)
                continue
            if content:
                contents.append(f"=== File: {os.path.basename(path)} ===\n{content}")

    history = _conversation_history(chat_context)
    if contents:
        yield f"Loaded {len(contents)} document(s)."
        prompt = DIRECT_QA_PROMPT.format(
            history=history, documents="\n\n".join(contents), query=query
        )
    else:
        yield "No document content available; answering from parametric knowledge."
        prompt = DIRECT_QA_NO_DOCUMENT_PROMPT.format(history=history, query=query)

    yield f"{TEMPORARY_TAG} Generating the answer..."
    yield f"{FINAL_ANSWER_MARKER} {get_llm_response(prompt, model=model)}"


def run_cycleie(
    query: str,
    documents: List[str],
    doc_mode: str = "paths",
    model: str = None,
    custom_params: Dict = None,
    callback: Optional[Callable[..., None]] = None,
    variant: str = "full",
) -> Dict:
    """Answer ``query`` over ``documents`` and return the answer and thought trail.

    Args:
        query: The analytical task to answer.
        documents: Document paths, or raw document contents when
            ``doc_mode="contents"``.
        doc_mode: ``"paths"`` or ``"contents"``.
        model: Backbone model for every agent; defaults to the configured one.
        custom_params: Extra keyword arguments for the ``DocumentManager``, or a
            preloaded one under the key ``doc_manager``.
        callback: Receives each thought as it is produced.
        variant: ``"full"``, ``"wo_verify"`` or ``"wo_extract"``.
    """
    if model:
        set_model(model)

    state = CycleIEState(callback=callback)

    if not documents:
        return {
            "answer": get_llm_response(NO_DOCUMENT_PROMPT.format(query=query)),
            "thought_process": "No documents provided; answered from parametric knowledge.",
        }

    try:
        doc_manager = _prepare(documents, doc_mode, custom_params)
    except ValueError as error:
        return {"answer": str(error), "thought_process": state.get_thought_trail()}

    controller = WorkflowController(state, doc_manager, variant=variant)
    try:
        answer = controller.execute(query, documents=documents, doc_mode=doc_mode)
    except Exception as error:
        logger.exception("CycleIE run failed")
        return {
            "answer": f"Error during document analysis: {error}",
            "thought_process": state.get_thought_trail(),
        }

    return {"answer": answer, "thought_process": state.get_thought_trail()}


def stream_cycleie(
    query: str,
    documents: List[str],
    doc_mode: str = "paths",
    model: str = None,
    custom_params: Dict = None,
    callback: Optional[Callable[..., None]] = None,
    variant: str = "full",
) -> Iterator[str]:
    """Same as :func:`run_cycleie` but yields the thoughts as they happen.

    The controller runs on a worker thread and pushes every thought into a
    queue, so the caller sees the reasoning trail while the loop is still
    iterating. The final answer is preceded by ``FINAL ANSWER:``.
    """
    if model:
        set_model(model)

    thoughts: "queue.Queue" = queue.Queue()

    def on_thought(thought: str, temporary: bool = False) -> None:
        thoughts.put(thought)
        if callback is None:
            return
        try:
            callback(thought, temporary=temporary)
        except TypeError:
            callback(thought)

    state = CycleIEState(callback=on_thought)

    yield f"{TEMPORARY_TAG} Starting the analysis of: {query}"

    if not documents:
        yield f"{FINAL_ANSWER_MARKER} {get_llm_response(NO_DOCUMENT_PROMPT.format(query=query))}"
        return

    yield f"{TEMPORARY_TAG} Loading and indexing the documents..."
    try:
        doc_manager = _prepare(documents, doc_mode, custom_params)
    except ValueError as error:
        yield str(error)
        return

    controller = WorkflowController(state, doc_manager, variant=variant)
    error_box = {}

    def run() -> None:
        try:
            controller.execute(query, documents=documents, doc_mode=doc_mode)
        except Exception as error:  # surfaced to the caller below
            logger.exception("CycleIE run failed")
            error_box["error"] = error

    worker = threading.Thread(target=run, daemon=True)
    worker.start()

    while worker.is_alive() or not thoughts.empty():
        while not thoughts.empty():
            yield thoughts.get()
        time.sleep(STREAM_POLL_SECONDS)

    if "error" in error_box:
        yield f"Error during document analysis: {error_box['error']}"
        return

    yield f"{FINAL_ANSWER_MARKER} {controller.result or 'No answer generated.'}"
