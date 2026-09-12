"""Planner: optional preprocessing that splits a task into unit questions.

The Planner sits outside the six-agent extraction loop. It is enabled when the
task is too complex to be answered by a single unit question, which is the case
for every query of the Loong benchmark used in the paper.
"""

import logging
import os
from typing import Dict, List

from ..llm import get_llm_response
from ..utils.json_utils import extract_json_from_text
from ..utils.text_utils import language_instruction
from .base_agent import BaseAgent

logger = logging.getLogger(__name__)

PROMPT = """As an expert research assistant, analyze and break down this query into clear executable steps:

ORIGINAL QUERY: "{query}"{document_info}

{document_content}

For each step, provide:
1. A clear description of what needs to be done
2. Whether document retrieval is needed for this step
3. Specific keywords to search for (if document retrieval is needed)
4. Dependencies on previous steps (if any)
5. Use as few steps as possible; ideally, complete it in a single step. If it can be done in one step, there is no need for a second step to summarize the first, and just use the original query.

Important: For each step, consider if it depends on results from previous steps. If it does, list those dependencies.

CONSTRAINT: A step can ONLY depend on steps with LOWER step numbers (i.e., steps that come before it). For example, Step 3 can depend on Steps 1 and 2, but not on Steps 4, 5, etc.

The last step must be a synthesis step that integrates results from previous steps to provide the final answer.
Also, the last step description should concat the ORIGINAL QUERY in the last sentence.

Output in JSON format with the following structure:
{{
    "steps": [
        {{
            "step_number": 1,
            "description": "...",
            "requires_document": true/false,
            "search_keywords": ["keyword1", "keyword2", ...],
            "reasoning": "...",
            "depends_on_steps": [list of step numbers this step depends on]
        }},
        ...
    ]
}}{language}
"""


def _fallback_plan(query: str) -> Dict:
    """Two-step plan used when the Planner output cannot be parsed."""
    return {
        "steps": [
            {
                "step_number": 1,
                "description": f"Search for information related to: {query}",
                "requires_document": True,
                "search_keywords": query.split(),
                "reasoning": "Need to find relevant information in the documents.",
                "depends_on_steps": [],
            },
            {
                "step_number": 2,
                "description": f"Synthesize an answer to: {query}",
                "requires_document": False,
                "reasoning": "Need to turn the retrieved information into an answer.",
                "depends_on_steps": [1],
            },
        ]
    }


def task_decomposer(
    query: str,
    state,
    documents: List[str] = None,
    doc_mode: str = "paths",
    retrieval_mode: str = "llm",
) -> Dict:
    """Decompose ``query`` into unit questions with their retrieval requirements."""
    document_info = ""
    document_content = ""
    if documents:
        if doc_mode == "paths":
            names = ", ".join(os.path.basename(path) for path in documents)
            document_info = f"\nAvailable documents: {names}"
        else:
            document_content = f"DOCUMENT CONTENT: {documents[0]}"

    prompt = PROMPT.format(
        query=query,
        document_info=document_info,
        document_content=document_content,
        language=language_instruction(query),
    )

    plan = extract_json_from_text(get_llm_response(prompt))
    if not isinstance(plan, dict) or not plan.get("steps"):
        state.add_thought("planner", "Could not parse the decomposition; falling back to a two-step plan.")
        plan = _fallback_plan(query)

    for step in plan["steps"]:
        step["depends_on_steps"] = [
            dep for dep in step.get("depends_on_steps", []) if dep < step.get("step_number", 0)
        ]
        if documents and step.get("requires_document", False):
            key = "document_paths" if doc_mode == "paths" else "document_contents"
            step[key] = documents
            step["retrieval_mode"] = retrieval_mode

    return plan


def normalize_steps(steps: List[Dict]) -> List[Dict]:
    """Renumber steps and make sure dependencies point backwards only."""
    for index, step in enumerate(steps, start=1):
        step["step_number"] = index

    for step in steps:
        step["depends_on_steps"] = [
            dep for dep in step.get("depends_on_steps", []) if dep < step["step_number"]
        ]

    # The synthesis step has to see every preceding step.
    if len(steps) > 1 and not steps[-1]["depends_on_steps"]:
        steps[-1]["depends_on_steps"] = list(range(1, steps[-1]["step_number"]))

    return steps


class PlannerAgent(BaseAgent):
    """Decomposes a complex task into unit questions."""

    name = "planner"

    def execute(self, query: str, documents: List[str] = None, doc_mode: str = "paths") -> Dict:
        plan = task_decomposer(query, self.state, documents, doc_mode)
        plan["steps"] = normalize_steps(plan["steps"])
        return plan
