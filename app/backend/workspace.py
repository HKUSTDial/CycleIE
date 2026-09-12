"""Filesystem layout of the demo application.

Documents, chat history and FAISS indices live either in the default workspace
or in a named project. ``Workspace`` resolves the right directories for both
cases so the request handlers do not have to branch on ``project_id``.
"""

import json
import os
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

BASE_DIR = Path(__file__).resolve().parent
PROJECTS_DIR = BASE_DIR / "projects"
PUBLIC_FILES_DIR = BASE_DIR / "public_files"

ALLOWED_EXTENSIONS = {"pdf", "txt", "md", "csv", "xlsx", "xls"}

#: Characters that are unsafe in a path on any supported platform. Everything
#: else is kept, so that non-ASCII file names survive an upload.
UNSAFE_CHARS = '/\\:*?"<>|\x00'
MAX_FILENAME_BYTES = 255


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def safe_filename(filename: str) -> str:
    """Strip path separators and control characters, keeping non-ASCII names."""
    if not filename:
        return filename

    safe = "".join("_" if char in UNSAFE_CHARS else char for char in filename)
    safe = safe.strip(" .")
    if safe in ("", ".", ".."):
        return "untitled"

    if len(safe.encode("utf-8")) > MAX_FILENAME_BYTES:
        stem, suffix = os.path.splitext(safe)
        budget = MAX_FILENAME_BYTES - len(suffix.encode("utf-8"))
        # Cut on a character boundary rather than in the middle of a code point.
        stem = stem.encode("utf-8")[:budget].decode("utf-8", errors="ignore")
        safe = stem + suffix

    return safe


def unique_path(directory: Path, filename: str) -> Path:
    """Return a path in ``directory`` that does not collide with an existing file."""
    candidate = directory / filename
    if not candidate.exists():
        return candidate

    stem, suffix = os.path.splitext(filename)
    counter = 1
    while candidate.exists():
        candidate = directory / f"{stem}_{counter}{suffix}"
        counter += 1
    return candidate


class Workspace:
    """The directories belonging to the default workspace or to one project."""

    def __init__(self, project_id: Optional[str] = None):
        self.project_id = project_id
        self.root = PROJECTS_DIR / project_id if project_id else BASE_DIR

    @property
    def uploads(self) -> Path:
        return self.root / "uploads"

    @property
    def chat_history(self) -> Path:
        return self.root / "chat_history"

    @property
    def faiss_index(self) -> Path:
        return self.root / "faiss_index"

    @property
    def config_file(self) -> Path:
        return self.root / "config.json"

    def create(self) -> None:
        for directory in (self.uploads, self.chat_history, self.faiss_index):
            directory.mkdir(parents=True, exist_ok=True)

    def contains(self, path: str) -> bool:
        """Whether ``path`` lies inside this workspace's upload directory."""
        try:
            Path(path).resolve().relative_to(self.uploads.resolve())
        except ValueError:
            return False
        return True

    def list_documents(self) -> List[Dict]:
        if not self.uploads.exists():
            return []
        return [
            {"filename": entry.name, "filepath": str(entry), "size": entry.stat().st_size}
            for entry in sorted(self.uploads.iterdir())
            if entry.is_file() and allowed_file(entry.name)
        ]

    def document_paths(self) -> List[str]:
        return [document["filepath"] for document in self.list_documents()]


def list_projects() -> List[Dict]:
    """Return every project with its document and conversation counts."""
    if not PROJECTS_DIR.exists():
        return []

    projects = []
    for entry in PROJECTS_DIR.iterdir():
        workspace = Workspace(entry.name)
        if not (entry.is_dir() and workspace.config_file.exists()):
            continue

        config = json.loads(workspace.config_file.read_text(encoding="utf-8"))
        chats = sorted(workspace.chat_history.glob("*.json")) if workspace.chat_history.exists() else []
        last_chat_time = max(
            (datetime.fromtimestamp(chat.stat().st_mtime).isoformat() for chat in chats),
            default=None,
        )
        projects.append({
            "id": entry.name,
            "name": config.get("name", entry.name),
            "description": config.get("description", ""),
            "created_at": config.get("created_at", ""),
            "last_modified": config.get("last_modified", ""),
            "last_chat_time": last_chat_time,
            "chat_count": len(chats),
            "document_count": len(workspace.list_documents()),
        })

    # Recently used projects first; projects without any conversation go last.
    projects.sort(key=lambda p: (bool(p["last_chat_time"]), p["last_chat_time"] or p["created_at"]), reverse=True)
    return projects


def create_project(name: str, description: str = "") -> Dict:
    project_id = str(uuid.uuid4())
    workspace = Workspace(project_id)
    workspace.create()

    now = datetime.now().isoformat()
    config = {
        "id": project_id,
        "name": name,
        "description": description,
        "created_at": now,
        "last_modified": now,
    }
    workspace.config_file.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")
    return config


def update_project(project_id: str, name: str, description: str = "") -> Optional[Dict]:
    workspace = Workspace(project_id)
    if not workspace.config_file.exists():
        return None

    config = json.loads(workspace.config_file.read_text(encoding="utf-8"))
    config.update({
        "name": name,
        "description": description,
        "last_modified": datetime.now().isoformat(),
    })
    workspace.config_file.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")
    return config


def delete_project(project_id: str) -> bool:
    workspace = Workspace(project_id)
    if not workspace.root.exists():
        return False
    shutil.rmtree(workspace.root)
    return True


def list_public_files() -> List[Dict]:
    """Documents shipped with the application that users can import."""
    if not PUBLIC_FILES_DIR.exists():
        return []
    return [
        {"filename": entry.name, "filepath": str(entry), "size": entry.stat().st_size}
        for entry in sorted(PUBLIC_FILES_DIR.iterdir())
        if entry.is_file() and allowed_file(entry.name)
    ]


def is_public_file(path: str) -> bool:
    try:
        Path(path).resolve().relative_to(PUBLIC_FILES_DIR.resolve())
    except ValueError:
        return False
    return True
