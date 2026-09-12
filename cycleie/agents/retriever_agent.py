"""Retriever: selects the document segments that a unit question needs.

Two retrieval modes are available. ``vector`` encodes the user documents into a
FAISS index and searches it; ``llm`` hands the documents to a long-context model
and asks it to return the relevant fragments verbatim. ``llm`` is the default and
is the mode used for the experiments in the paper.
"""

import logging
from typing import TYPE_CHECKING, Dict

from ..config import (
    LONG_CONTEXT_MODEL,
    RETRIEVAL_TRIGGER_THRESHOLD,
    RETRIEVER_DIRECT_PASS_LENGTH,
)
from ..llm import get_llm_response
from ..utils.text_utils import content_length, language_instruction
from .base_agent import BaseAgent

if TYPE_CHECKING:  # imported lazily so the agent stays free of index deps
    from ..core.document_manager import DocumentManager

logger = logging.getLogger(__name__)

FRAGMENT_PROMPT = """- Each fragment must:
- Retain **complete semantic meaning** (e.g., full paragraphs, full tables, bullet lists, or code blocks).
- **Preserve structured content** (do not cut off tables, item lists, or inline references).
- Come from a document that clearly contains information relevant to the question.

- Limitations:
- Each fragment should be **no longer than 500 tokens** (truncate carefully if necessary, without breaking structure).
- Return **at most 3 fragments**, prioritized by **most relevant first**.
- If no content is relevant, return nothing.

---

**Output format** (one per line, sorted by relevance):

```
<filename>: <relevant content>
<filename>: <relevant content>
...
```

- Do not summarize, generate answers, or include explanations.
- Only output the selected fragments in the format above.

---

**Question**:
{question}

**Documents**:
{documents}{language}
"""

VECTOR_TOP_K = 5


def context_retriever(
    step_info: Dict,
    doc_manager: "DocumentManager",
    state,
    doc_mode: str = "paths",
    retrieval_mode: str = "llm",
) -> str:
    """Retrieve the segments ``R_i`` relevant to the unit question."""
    step_num = step_info.get("step_number", state.current_step)
    mode = step_info.get("retrieval_mode", retrieval_mode)

    if not step_info.get("requires_document", False):
        state.add_thought("retriever", f"Step {step_num} does not need document retrieval.")
        return "Document retrieval not needed for this step."

    description = step_info.get("description", "")
    keywords = step_info.get("search_keywords", [])
    if not description and not keywords:
        return "No search keywords or description available."

    search_query = f"{description} [SEP] {' '.join(keywords)}" if keywords else description
    state.add_thought("retriever", f'Query used: "{search_query}"')

    documents = step_info.get("document_paths" if doc_mode == "paths" else "document_contents")

    if mode == "vector" and doc_mode == "paths":
        result = _vector_retrieve(search_query, doc_manager, documents, step_info, state)
    elif mode == "llm":
        result = _long_context_retrieve(
            search_query,
            doc_manager,
            documents,
            doc_mode,
            state,
            use_fallback_corpus=_context_quality_too_low(state, step_num),
        )
    else:
        state.add_thought("retriever", f"Unsupported configuration: retrieval_mode={mode}, doc_mode={doc_mode}")
        return f"Unsupported retrieval configuration: retrieval_mode={mode}, doc_mode={doc_mode}"

    state.retrieved_docs[step_num] = result
    state.retrieved_context[step_num] = result
    state.add_thought("retriever", result)
    return result


def _vector_retrieve(search_query, doc_manager, documents, step_info, state) -> str:
    top_k = step_info.get("top_k", VECTOR_TOP_K)
    chunks = doc_manager.retrieve_relevant_documents(search_query, k=top_k, document_paths=documents)
    if not chunks:
        state.add_thought("retriever", "No relevant chunks found; the keywords may need to be revised.")
        return "No relevant documents found. Consider adjusting search keywords."

    return "\n\n".join(
        f"Chunk {index} from {chunk.metadata.get('source', 'unknown source')}:\n{chunk.page_content}"
        for index, chunk in enumerate(chunks)
    )


def _context_quality_too_low(state, step_num: int) -> bool:
    """Whether the Verifier judged the current context insufficient.

    Retrieval proceeds in two stages: a unit question first uses the primary
    context, and only falls back to searching the full corpus once the average
    of completeness and relevance drops below the threshold.
    """
    verification = state.verification_results.get(step_num)
    if not verification:
        return False
    completeness = verification.get("completeness", 0)
    relevance = verification.get("relevance", 0)
    return (completeness + relevance) / 2 < RETRIEVAL_TRIGGER_THRESHOLD


def _long_context_retrieve(search_query, doc_manager, documents, doc_mode, state, use_fallback_corpus=False) -> str:
    if doc_mode == "contents":
        documents = documents or [""]
        # documents[0] is the primary context; documents[1], when present, is
        # the full corpus that the long-context model searches on fallback.
        corpus = documents[1] if use_fallback_corpus and len(documents) > 1 else documents[0]
    else:
        loaded = []
        for path in documents or []:
            try:
                loaded.append(f"Content from {path}:\n{doc_manager.load_document_content(path)}")
            except (FileNotFoundError, ValueError) as error:
                state.add_thought("retriever", f"Could not read {path}: {error}")
        if not loaded:
            return "Could not load contents from the specified document paths."
        corpus = "\n\n".join(loaded)

    # Short enough to be handed to the Extractor without compression.
    if content_length(corpus) <= RETRIEVER_DIRECT_PASS_LENGTH:
        return corpus

    prompt = FRAGMENT_PROMPT.format(
        question=search_query,
        documents=corpus,
        language=language_instruction(search_query),
    )
    return get_llm_response(prompt, model=LONG_CONTEXT_MODEL)


class RetrieverAgent(BaseAgent):
    """Retrieves relevant document segments, re-running on a retrieval signal."""

    name = "retriever"

    def __init__(self, state, doc_manager: "DocumentManager"):
        super().__init__(state)
        self.doc_manager = doc_manager

    def execute(self, step_info: Dict, doc_mode: str = "paths", retrieval_mode: str = "llm") -> str:
        self.add_temp_thought("Retrieving documents related to the question...")
        return context_retriever(step_info, self.doc_manager, self.state, doc_mode, retrieval_mode)
