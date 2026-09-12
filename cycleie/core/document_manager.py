"""Loading, chunking and dense indexing of the user-provided documents.

CycleIE operates on a document collection supplied by the user; no external
corpus is retrieved. A global FAISS index covers the whole collection and one
dedicated index per document makes it possible to restrict retrieval to the
documents selected for a query.
"""

import logging
import os
from pathlib import Path
from typing import List, Optional

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import (
    CSVLoader,
    PyPDFLoader,
    TextLoader,
    UnstructuredExcelLoader,
    UnstructuredMarkdownLoader,
)
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document

logger = logging.getLogger(__name__)

CHUNK_SIZE = 800
CHUNK_OVERLAP = 150

LOADERS = {
    ".pdf": PyPDFLoader,
    ".txt": TextLoader,
    ".md": UnstructuredMarkdownLoader,
    ".csv": CSVLoader,
    ".xlsx": UnstructuredExcelLoader,
    ".xls": UnstructuredExcelLoader,
}


def _loader_for(path: Path):
    loader_cls = LOADERS.get(path.suffix.lower())
    if loader_cls is None:
        raise ValueError(f"Unsupported file format: {path}")
    return loader_cls(str(path))


class DocumentManager:
    """Manages document loading, indexing and dense retrieval."""

    def __init__(self, embedding_model=None, faiss_index_path: str = "./faiss_index"):
        if embedding_model is None:
            # Imported here so that torch is only required for vector retrieval.
            from ..embeddings import RobertaEmbeddings

            embedding_model = RobertaEmbeddings()
        self.embedding_model = embedding_model
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP
        )
        self.faiss_index_path = faiss_index_path
        self.document_store: Optional[FAISS] = None
        self.document_chunks: List[Document] = []
        self.document_source_map = {}  # source path -> indices into document_chunks
        self.document_indices = {}  # source path -> dedicated FAISS index

    # -- loading ------------------------------------------------------------

    def load_documents(self, document_paths: List[str]) -> List[Document]:
        """Load the given files and split them into chunks."""
        documents = []
        for path in document_paths:
            path_obj = Path(path)
            if not path_obj.exists():
                logger.warning("Document not found: %s", path)
                continue
            try:
                loaded = _loader_for(path_obj).load()
            except (ValueError, OSError) as error:
                logger.error("Could not load %s: %s", path, error)
                continue

            for doc in loaded:
                doc.metadata["source"] = str(path_obj)
            documents.extend(loaded)

        if documents:
            self.document_chunks = self.text_splitter.split_documents(documents)
            self._rebuild_source_map(self.document_chunks, start=0)
            logger.info("Split %d documents into %d chunks", len(documents), len(self.document_chunks))

        return self.document_chunks

    def load_document_content(self, document_path: str) -> str:
        """Return the full text of a document without chunking."""
        path_obj = Path(document_path)
        if not path_obj.exists():
            raise FileNotFoundError(f"Document not found: {document_path}")
        return "\n\n".join(doc.page_content for doc in _loader_for(path_obj).load())

    def _rebuild_source_map(self, chunks: List[Document], start: int) -> None:
        for offset, chunk in enumerate(chunks, start=start):
            source = chunk.metadata.get("source")
            if source:
                self.document_source_map.setdefault(source, []).append(offset)

    # -- indexing -----------------------------------------------------------

    def index_documents(self, documents: List[Document]) -> Optional[FAISS]:
        """Build the global index plus one dedicated index per document."""
        documents = documents or self.document_chunks
        if not documents:
            logger.error("No documents to index")
            return None

        self.document_store = FAISS.from_documents(documents, self.embedding_model)

        for source, chunk_indices in self.document_source_map.items():
            source_chunks = [self.document_chunks[i] for i in chunk_indices]
            self.document_indices[source] = FAISS.from_documents(source_chunks, self.embedding_model)

        self._persist()
        logger.info("Indexed %d chunks", len(documents))
        return self.document_store

    def add_documents(self, new_documents: List[Document]) -> None:
        """Add documents that are not part of the index yet."""
        unseen = [
            doc for doc in new_documents or []
            if doc.metadata.get("source") and doc.metadata["source"] not in self.document_source_map
        ]
        if not unseen:
            return

        new_chunks = self.text_splitter.split_documents(unseen)
        self._rebuild_source_map(new_chunks, start=len(self.document_chunks))
        self.document_chunks.extend(new_chunks)

        if self.document_store is None:
            self.index_documents(new_chunks)
            return

        self.document_store.add_documents(new_chunks)
        new_sources = {doc.metadata["source"] for doc in unseen}
        for source in new_sources:
            source_chunks = [self.document_chunks[i] for i in self.document_source_map[source]]
            self.document_indices[source] = FAISS.from_documents(source_chunks, self.embedding_model)

        self._persist()
        logger.info("Added %d chunks to the index", len(new_chunks))

    def load_faiss_index(self) -> Optional[FAISS]:
        """Load a previously persisted index, if one exists."""
        if not os.path.exists(self.faiss_index_path):
            return None
        try:
            self.document_store = FAISS.load_local(
                self.faiss_index_path, self.embedding_model, allow_dangerous_deserialization=True
            )
        except Exception as error:
            logger.error("Could not load FAISS index: %s", error)
            return None

        per_document_dir = os.path.join(self.faiss_index_path, "document_indices")
        if os.path.isdir(per_document_dir):
            for name in os.listdir(per_document_dir):
                index_path = os.path.join(per_document_dir, name)
                if not os.path.isdir(index_path):
                    continue
                source = self._source_for_basename(name)
                if source is None:
                    continue
                try:
                    self.document_indices[source] = FAISS.load_local(
                        index_path, self.embedding_model, allow_dangerous_deserialization=True
                    )
                except Exception as error:
                    logger.error("Could not load index for %s: %s", name, error)

        return self.document_store

    def _persist(self) -> None:
        os.makedirs(self.faiss_index_path, exist_ok=True)
        self.document_store.save_local(self.faiss_index_path)

        per_document_dir = os.path.join(self.faiss_index_path, "document_indices")
        os.makedirs(per_document_dir, exist_ok=True)
        for source, index in self.document_indices.items():
            index.save_local(os.path.join(per_document_dir, os.path.basename(source)))

    def _source_for_basename(self, basename: str) -> Optional[str]:
        for source in self.document_source_map:
            if os.path.basename(source) == basename:
                return source
        return None

    # -- retrieval ----------------------------------------------------------

    def retrieve_relevant_documents(
        self, query: str, k: int = 5, document_paths: List[str] = None
    ) -> List[Document]:
        """Return the ``k`` most similar chunks, optionally per selected document."""
        if self.document_store is None:
            logger.error("FAISS index is not initialised")
            return []

        if not document_paths:
            return self.document_store.similarity_search(query, k=k)

        results = []
        for path in document_paths:
            path = str(Path(path))
            index = self.document_indices.get(path)
            if index is not None:
                results.extend(index.similarity_search(query, k=k))
            elif path in self.document_source_map:
                # No dedicated index yet: filter the global index by source.
                candidates = self.document_store.similarity_search(query, k=len(self.document_chunks))
                results.extend([d for d in candidates if d.metadata.get("source") == path][:k])

        return results or self.document_store.similarity_search(query, k=k)
