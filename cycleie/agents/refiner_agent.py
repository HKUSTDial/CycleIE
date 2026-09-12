"""Refiner: reformulates a unit question that is not getting anywhere.

Triggered by the "poor question" signal. The Refiner first tries to sharpen the
current unit question; only when that is not possible does it split the question
into sub-questions.
"""

import json
import logging
from typing import Dict, List, Optional

from ..llm import get_llm_response
from ..utils.json_utils import extract_json_from_text
from .base_agent import BaseAgent

logger = logging.getLogger(__name__)

RETRIEVED_PREVIEW_CHARS = 500

PROMPT = """You are a task optimization expert, assisting in refining the current step to better answer the question.

MAIN QUESTION: {main_question}

CURRENT STEP BEING PROCESSED: {step_description}

INFORMATION WE HAVE ALREADY EXTRACTED:
{extracted}

CONTENT WE HAVE RETRIEVED FROM DOCUMENTS:
{retrieved}

VERIFICATION RESULTS:
{verification}

First, analyze whether the current step is effective. If it is valid but can be improved, try to:
1. Improve the step description to make it clearer and more specific.
2. Optimize the search keywords to make them more targeted.
3. Adjust the reasoning process and dependencies of the step.

Only consider generating sub-questions if the current step cannot be optimized.

Please return your optimization results in the following JSON format:
{{
    "steps": [
        {{
            "step_number": {step_number},
            "description": "Revised step description",
            "requires_document": true/false,
            "search_keywords": ["keyword1", "keyword2", ...],
            "reasoning": "Justification for why this step needs to be optimized this way"
        }}
    ],
    "optimization_type": "refine_current_step" or "generate_sub_questions"
}}

If you choose to generate sub-questions, include 2 to 3 new sub-steps in the `steps` section that will help answer the main question.
"""


def _reset_attempt_counters(step: Dict, actions: List[str]) -> Dict:
    """A reformulated question starts its own budget."""
    for action in actions:
        step.pop(f"{action}_attempts", None)
    return step


def step_optimize(step_info: Dict, state, actions: List[str]) -> Optional[Dict]:
    """Rewrite the unit question, or split it into sub-questions.

    Returns the unit question to run next. When the question is split, the
    remaining sub-questions are inserted into ``state.steps`` and the first one
    is returned.
    """
    step_num = step_info.get("step_number", state.current_step)
    retrieved = state.retrieved_docs.get(step_num, "")
    verification = state.verification_results.get(step_num, {})

    prompt = PROMPT.format(
        main_question=step_info.get("description", ""),
        step_description=step_info.get("description", ""),
        step_number=step_num,
        extracted=state.extracted_info.get(step_num) or "No information has been extracted yet.",
        retrieved=(retrieved[:RETRIEVED_PREVIEW_CHARS] + "...") if len(retrieved) > RETRIEVED_PREVIEW_CHARS
        else (retrieved or "No documents have been retrieved yet."),
        verification=json.dumps(verification, ensure_ascii=False, indent=2) if verification
        else "No verification has been performed yet.",
    )

    result = extract_json_from_text(get_llm_response(prompt))
    new_steps = [s for s in result.get("steps", []) if s.get("description")]
    if not new_steps:
        return _reset_attempt_counters(dict(step_info), actions)

    for new_step in new_steps:
        _reset_attempt_counters(new_step, actions)
        # A step that needs keywords necessarily needs the documents.
        if new_step.get("search_keywords"):
            new_step["requires_document"] = True
        for key in ("document_paths", "document_contents", "retrieval_mode"):
            if key in step_info:
                new_step.setdefault(key, step_info[key])

    if result.get("optimization_type") == "generate_sub_questions" and len(new_steps) > 1:
        state.add_thought("refiner", f"Split the step into {len(new_steps)} sub-questions.")
        for offset, sub_step in enumerate(new_steps):
            sub_step["step_number"] = step_num + offset
        position = next(
            (i for i, s in enumerate(state.steps) if s.get("step_number") == step_num), None
        )
        if position is not None:
            state.steps[position:position + 1] = new_steps
        return new_steps[0]

    state.add_thought("refiner", f"Reformulated the step as: {new_steps[0]['description']}")
    new_steps[0]["step_number"] = step_num
    return new_steps[0]


class RefinerAgent(BaseAgent):
    """Reformulates or decomposes a unit question on a "poor question" signal."""

    name = "refiner"

    def execute(self, step_info: Dict, actions: List[str]) -> Optional[Dict]:
        self.add_temp_thought("Reformulating the current step...")
        return step_optimize(step_info, self.state, actions)
