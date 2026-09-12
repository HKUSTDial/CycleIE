"""HTTP API of the CycleIE demo application.

The server wraps the ``cycleie`` package: documents are uploaded into a
workspace, indexed with FAISS, and questions are answered either by the full
CycleIE loop or, when the loop is switched off, by a single-pass baseline. The
reasoning trail is streamed to the browser over server-sent events.

Run it with ``python run.py``.
"""

import base64
import json
import logging
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

from flask import Flask, Response, jsonify, request
from flask_cors import CORS

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPOSITORY_ROOT))

import chat_store
import workspace as ws
from cycleie import DocumentManager, stream_cycleie, stream_direct_qa
from cycleie.core.state import TEMPORARY_TAG
from cycleie.core.workflow import FINAL_ANSWER_MARKER
from cycleie.llm import get_model, set_model
from formulas import normalize_math_formulas

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ALLOWED_ORIGINS = os.getenv("CYCLEIE_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
ENV_FILE = REPOSITORY_ROOT / ".env"
SETTINGS_FILE = ws.BASE_DIR / "config.json"
MAX_CONTEXT_TURNS = 5

app = Flask(__name__)
CORS(
    app,
    origins=ALLOWED_ORIGINS,
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
)

ws.Workspace().create()

#: One document manager per workspace, so switching projects never indexes the
#: wrong collection. Created on first use because the embedding model is heavy.
_managers: Dict[Optional[str], DocumentManager] = {}


def workspace_for(project_id=None) -> ws.Workspace:
    """Return the addressed workspace, creating its directories if needed."""
    workspace = ws.Workspace(project_id)
    workspace.create()
    return workspace


def manager_for(project_id=None) -> DocumentManager:
    """Return the document manager for a workspace, loading its index if saved."""
    if project_id in _managers:
        return _managers[project_id]

    workspace = workspace_for(project_id)
    manager = DocumentManager(faiss_index_path=str(workspace.faiss_index))
    if manager.load_faiss_index() is None:
        logger.info("No FAISS index for %s yet; it will be built on first use.", project_id or "default")
    _managers[project_id] = manager
    return manager


def sse(event: str, payload: dict) -> bytes:
    return f"event: {event}\ndata: {json.dumps(payload)}\n\n".encode("utf-8")


# --- documents ---------------------------------------------------------------

@app.route("/api/upload", methods=["POST"])
@app.route("/api/projects/<project_id>/upload", methods=["POST"])
def upload_file(project_id=None):
    workspace = workspace_for(project_id)

    uploaded = request.files.get("file")
    if uploaded is None or not uploaded.filename:
        return jsonify({"error": "No file provided"}), 400
    if not ws.allowed_file(uploaded.filename):
        return jsonify({"error": "File type not allowed"}), 400

    filename = ws.safe_filename(uploaded.filename)
    path = workspace.uploads / filename
    if path.exists():
        return jsonify({
            "status": "exists",
            "message": f"File '{filename}' already exists",
            "filename": filename,
            "filepath": str(path),
        }), 409

    uploaded.save(path)
    return jsonify({
        "status": "success",
        "message": "File uploaded successfully",
        "filename": filename,
        "filepath": str(path),
    }), 200


@app.route("/api/upload/batch", methods=["POST"])
@app.route("/api/projects/<project_id>/upload/batch", methods=["POST"])
def upload_batch_files(project_id=None):
    """Upload several files at once, renaming rather than overwriting collisions."""
    workspace = workspace_for(project_id)

    files = [f for f in request.files.getlist("files") if f.filename]
    if not files:
        return jsonify({"error": "No files selected"}), 400

    uploaded, failed = [], []
    for upload in files:
        if not ws.allowed_file(upload.filename):
            failed.append({"filename": upload.filename, "error": "File type not allowed"})
            continue

        filename = ws.safe_filename(os.path.basename(upload.filename))
        path = ws.unique_path(workspace.uploads, filename)
        try:
            upload.save(path)
        except OSError as error:
            logger.error("Could not save %s: %s", filename, error)
            failed.append({"filename": upload.filename, "error": str(error)})
            continue

        uploaded.append({
            "filename": path.name,
            "original_filename": upload.filename,
            "filepath": str(path),
            "size": path.stat().st_size,
        })

    response = {
        "uploaded": uploaded,
        "failed": failed,
        "existing": [],
        "summary": {
            "total": len(files),
            "uploaded_count": len(uploaded),
            "failed_count": len(failed),
            "existing_count": 0,
        },
    }

    if not uploaded:
        response["status"] = "error"
        response["message"] = "No files were uploaded successfully"
        return jsonify(response), 400

    response["status"] = "success" if not failed else "partial"
    response["message"] = f"Uploaded {len(uploaded)} files"
    if failed:
        response["message"] += f", {len(failed)} failed"
    return jsonify(response), 200


@app.route("/api/upload/confirm-overwrite", methods=["POST"])
@app.route("/api/projects/<project_id>/upload/confirm-overwrite", methods=["POST"])
def confirm_overwrite(project_id=None):
    """Replace a file the user chose to overwrite after an upload conflict."""
    workspace = workspace_for(project_id)
    data = request.json or {}

    filepath = data.get("filepath")
    if not filepath or "file_data" not in data:
        return jsonify({"error": "Missing filepath or file_data"}), 400
    if not workspace.contains(filepath):
        return jsonify({"error": "File path not allowed"}), 403

    try:
        Path(filepath).write_bytes(base64.b64decode(data["file_data"]))
    except (ValueError, OSError) as error:
        return jsonify({"error": str(error)}), 400

    filename = os.path.basename(filepath)
    return jsonify({
        "status": "success",
        "message": f"File '{filename}' has been overwritten",
        "filename": filename,
        "filepath": filepath,
    }), 200


@app.route("/api/files", methods=["GET"])
@app.route("/api/projects/<project_id>/files", methods=["GET"])
def list_files(project_id=None):
    return jsonify({"files": workspace_for(project_id).list_documents()}), 200


@app.route("/api/files/delete", methods=["POST"])
@app.route("/api/projects/<project_id>/files/delete", methods=["POST"])
def delete_file(project_id=None):
    workspace = workspace_for(project_id)
    filepath = (request.json or {}).get("filepath")

    if not filepath:
        return jsonify({"error": "No filepath provided"}), 400
    if not workspace.contains(filepath):
        return jsonify({"error": "File path not allowed"}), 403

    path = Path(filepath)
    if not path.is_file():
        return jsonify({"error": "File not found"}), 404

    path.unlink()
    return jsonify({"message": "File deleted successfully"}), 200


@app.route("/api/files/content", methods=["GET"])
@app.route("/api/projects/<project_id>/files/content", methods=["GET"])
def get_file_content(project_id=None):
    """Return a document as text so the frontend can display it."""
    workspace = workspace_for(project_id)
    filepath = request.args.get("filepath")

    if not filepath:
        return jsonify({"error": "No filepath provided"}), 400
    if not workspace.contains(filepath):
        return jsonify({"error": "File path not allowed"}), 403

    path = Path(filepath)
    if not path.is_file():
        return jsonify({"error": "File not found"}), 404
    if not ws.allowed_file(path.name):
        return jsonify({"error": "File type not supported"}), 400

    extension = path.suffix.lstrip(".").lower()
    try:
        content = manager_for(project_id).load_document_content(str(path))
    except (ValueError, OSError) as error:
        logger.error("Could not read %s: %s", path, error)
        return jsonify({"error": f"Failed to read file: {error}"}), 500

    # Spreadsheets are rendered as CSV so the frontend can lay them out as a table.
    file_type = "csv" if extension in ("xlsx", "xls") else extension
    return jsonify({"content": content, "filename": path.name, "file_type": file_type}), 200


@app.route("/api/reload-index", methods=["POST"])
@app.route("/api/projects/<project_id>/reload-index", methods=["POST"])
def reload_index(project_id=None):
    """Rebuild the FAISS index from every document in the workspace."""
    workspace = workspace_for(project_id)
    paths = workspace.document_paths()

    previous = _managers.get(project_id)
    manager = DocumentManager(
        embedding_model=previous.embedding_model if previous else None,
        faiss_index_path=str(workspace.faiss_index),
    )

    if not paths:
        _managers[project_id] = manager
        if manager.load_faiss_index() is not None:
            return jsonify({"message": "Reloaded the existing index"}), 200
        return jsonify({"warning": "No documents found; the index will be built on first use"}), 200

    chunks = manager.load_documents(paths)
    if not chunks:
        _managers[project_id] = manager
        return jsonify({"warning": "None of the documents could be loaded"}), 200

    manager.index_documents(chunks)
    _managers[project_id] = manager
    return jsonify({"message": f"Indexed {len(chunks)} chunks from {len(paths)} documents"}), 200


# --- question answering ------------------------------------------------------

@app.route("/api/process", methods=["POST"])
@app.route("/api/projects/<project_id>/process", methods=["POST"])
def process_query(project_id=None):
    """Answer a question, streaming the reasoning trail as server-sent events."""
    workspace = workspace_for(project_id)
    data = request.json or {}

    query = data.get("query", "").strip()
    if not query:
        return jsonify({"error": "No query provided"}), 400

    chat_id = data.get("chat_id")
    is_edit = data.get("is_edit", False)
    cycleie_enabled = data.get("cycleie_enabled", True)
    model = data.get("model") or get_model()

    file_paths = data.get("file_paths") or []
    if not file_paths and data.get("use_all_files", False):
        file_paths = workspace.document_paths()

    chat_context = chat_store.context(workspace, chat_id, MAX_CONTEXT_TURNS) if chat_id else []

    if chat_id and not is_edit:
        selected_files = data.get("selected_files") or [
            {"filename": os.path.basename(path), "filepath": path} for path in file_paths
        ]
        chat_store.append(workspace, chat_id, "user", query, {
            "file_paths": file_paths,
            "selected_files": selected_files,
            "use_all_files": data.get("use_all_files", False),
            "cycleie_enabled": cycleie_enabled,
            "model": model,
        })

    doc_manager = manager_for(project_id)
    if cycleie_enabled:
        thoughts = stream_cycleie(
            query=query,
            documents=file_paths,
            model=model,
            custom_params={"doc_manager": doc_manager},
        )
    else:
        thoughts = stream_direct_qa(
            query=query,
            documents=file_paths,
            doc_manager=doc_manager,
            model=model,
            chat_context=chat_context,
        )

    def generate():
        yield sse("start", {})

        answer = ""
        trail = []
        for thought in thoughts:
            if thought.startswith(FINAL_ANSWER_MARKER):
                answer = normalize_math_formulas(thought[len(FINAL_ANSWER_MARKER):].strip())
                yield sse("answer", {"type": "answer", "content": answer})
                continue

            temporary = thought.startswith(TEMPORARY_TAG)
            if not temporary and cycleie_enabled:
                trail.append(thought)
            yield sse("thinking", {"type": "thinking", "content": thought, "temporary": temporary})

        if chat_id:
            additional_data = {"model": model, "cycleie_enabled": cycleie_enabled}
            if cycleie_enabled:
                additional_data["thought_process"] = trail
            chat_store.append(
                workspace, chat_id, "assistant", answer or "\n\n".join(trail), additional_data
            )

        yield sse("end", {})

    return Response(generate(), mimetype="text/event-stream")


# --- conversations -----------------------------------------------------------

@app.route("/api/chat/new", methods=["POST"])
@app.route("/api/projects/<project_id>/chat/new", methods=["POST"])
def create_new_chat(project_id=None):
    return jsonify({
        "id": str(uuid.uuid4()),
        "title": chat_store.DEFAULT_TITLE,
        "message_count": 0,
        "created_at": datetime.now().isoformat(),
    })


@app.route("/api/chat/history", methods=["GET"])
@app.route("/api/projects/<project_id>/chat/history", methods=["GET"])
def get_chat_history_list(project_id=None):
    return jsonify(chat_store.summaries(workspace_for(project_id)))


@app.route("/api/chat/history/<chat_id>", methods=["GET"])
@app.route("/api/projects/<project_id>/chat/history/<chat_id>", methods=["GET"])
def get_chat_history(chat_id, project_id=None):
    return jsonify(chat_store.load(workspace_for(project_id), chat_id))


@app.route("/api/chat/rename/<chat_id>", methods=["POST"])
@app.route("/api/projects/<project_id>/chat/rename/<chat_id>", methods=["POST"])
def rename_chat(chat_id, project_id=None):
    title = (request.json or {}).get("title", "").strip()
    if not title:
        return jsonify({"error": "Title cannot be empty"}), 400
    if not chat_store.rename(workspace_for(project_id), chat_id, title):
        return jsonify({"error": "Conversation not found"}), 404
    return jsonify({"success": True, "title": title})


@app.route("/api/chat/delete/<chat_id>", methods=["DELETE"])
@app.route("/api/projects/<project_id>/chat/delete/<chat_id>", methods=["DELETE"])
def delete_chat(chat_id, project_id=None):
    if not chat_store.delete(workspace_for(project_id), chat_id):
        return jsonify({"error": "Conversation not found"}), 404
    return jsonify({"success": True})


@app.route("/api/chat/edit/<chat_id>/<int:message_index>", methods=["POST"])
@app.route("/api/projects/<project_id>/chat/edit/<chat_id>/<int:message_index>", methods=["POST"])
def edit_message(chat_id, message_index, project_id=None):
    content = (request.json or {}).get("content", "").strip()
    if not content:
        return jsonify({"error": "Message content cannot be empty"}), 400

    try:
        messages = chat_store.edit(workspace_for(project_id), chat_id, message_index, content)
    except IndexError:
        return jsonify({"error": "Invalid message index"}), 400
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    return jsonify({"success": True, "message": "Message edited", "updated_history": messages})


# --- projects ----------------------------------------------------------------

@app.route("/api/projects", methods=["GET"])
def get_projects():
    return jsonify({"projects": ws.list_projects()})


@app.route("/api/projects", methods=["POST"])
def create_project():
    data = request.json or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "Project name is required"}), 400

    project = ws.create_project(name, data.get("description", "").strip())
    return jsonify({"success": True, "message": "Project created", "project": project})


@app.route("/api/projects/<project_id>", methods=["PUT"])
def update_project(project_id):
    data = request.json or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "Project name is required"}), 400

    project = ws.update_project(project_id, name, data.get("description", "").strip())
    if project is None:
        return jsonify({"error": "Project not found"}), 404
    return jsonify({"success": True, "message": "Project updated", "project": project})


@app.route("/api/projects/<project_id>", methods=["DELETE"])
def delete_project(project_id):
    if not ws.delete_project(project_id):
        return jsonify({"error": "Project not found"}), 404
    _managers.pop(project_id, None)
    return jsonify({"success": True, "message": "Project deleted"})


# --- bundled documents -------------------------------------------------------

@app.route("/api/public-files", methods=["GET"])
def list_public_files():
    return jsonify({"files": ws.list_public_files()}), 200


@app.route("/api/public-files/import", methods=["POST"])
@app.route("/api/projects/<project_id>/public-files/import", methods=["POST"])
def import_public_files(project_id=None):
    """Copy documents from the bundled library into a workspace."""
    import shutil

    workspace = workspace_for(project_id)
    filepaths = (request.json or {}).get("filepaths")
    if not isinstance(filepaths, list) or not filepaths:
        return jsonify({"error": "No filepaths provided"}), 400

    imported, existing, failed = [], [], []
    for source in filepaths:
        if not ws.is_public_file(source) or not Path(source).is_file():
            failed.append({"filepath": source, "error": "Source file not available"})
            continue

        filename = os.path.basename(source)
        target = workspace.uploads / filename
        if target.exists():
            existing.append({
                "filename": filename,
                "filepath": source,
                "message": f"File '{filename}' already exists",
            })
            continue

        shutil.copy2(source, target)
        imported.append({
            "filename": filename,
            "source_filepath": source,
            "target_filepath": str(target),
            "size": target.stat().st_size,
        })

    response = {
        "imported": imported,
        "existing": existing,
        "failed": failed,
        "summary": {
            "total": len(filepaths),
            "imported_count": len(imported),
            "existing_count": len(existing),
            "failed_count": len(failed),
        },
    }

    if not imported and not existing:
        response["status"] = "error"
        response["message"] = "No files were imported"
        return jsonify(response), 400

    response["status"] = "success" if not existing and not failed else "partial"
    response["message"] = f"Imported {len(imported)} files"
    return jsonify(response), 200


# --- settings ----------------------------------------------------------------

def _read_env() -> dict:
    if not ENV_FILE.exists():
        return {}
    entries = {}
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            entries[key.strip()] = value.strip()
    return entries


def _write_env(entries: dict) -> None:
    ENV_FILE.write_text("".join(f"{k}={v}\n" for k, v in entries.items()), encoding="utf-8")


@app.route("/api/settings", methods=["GET", "POST"])
def handle_settings():
    """Read or update the backbone model and the API credentials.

    The credentials are stored in the repository's ``.env`` file. The server is
    meant to be run locally by a single user; do not expose it on a network.
    """
    stored = {}
    if SETTINGS_FILE.exists():
        stored = json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))

    if request.method == "GET":
        model = request.args.get("model")
        if model:
            set_model(model)
        env = _read_env()
        return jsonify({
            **stored,
            "model": get_model(),
            "api_key": env.get("OPENAI_API_KEY", ""),
            "api_url": env.get("OPENAI_BASE_URL", ""),
        })

    data = request.json or {}
    if "model" in data:
        set_model(data["model"])

    if "api_key" in data or "api_url" in data:
        env = _read_env()
        if data.get("api_key"):
            env["OPENAI_API_KEY"] = data["api_key"]
        if data.get("api_url"):
            env["OPENAI_BASE_URL"] = data["api_url"]
        _write_env(env)

    other = {k: v for k, v in data.items() if k not in ("api_key", "api_url")}
    if other:
        stored.update(other)
        SETTINGS_FILE.write_text(json.dumps(stored, ensure_ascii=False, indent=2), encoding="utf-8")

    return jsonify({"success": True})
