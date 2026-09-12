"""Structurer: picks the structure that best fits a unit question.

Runs once per unit question and chooses among the four canonical structures of
Section 2 of the paper.
"""

import logging
import re
from typing import Dict

from ..llm import get_llm_response
from .base_agent import BaseAgent

logger = logging.getLogger(__name__)

#: The four canonical structures. ``Text Chunk`` is the default.
STRUCTURES = ["Text Chunk", "Tree", "Table", "Graph"]
DEFAULT_STRUCTURE = "Text Chunk"

PROMPT = """This is a data structure selection task. Based on the given `question`, choose the most suitable data structure to answer the question. You can choose from the following options:
{options}
Your answer should be concise and to the point. Return your answer in the following format directly: {{answer: data structure}}.

The question is: {question}
"""


def data_structure_selector(step_info: Dict, state) -> str:
    """Select the structure ``S_i`` used to represent the extracted content."""
    question = step_info.get("description", "")
    step_num = step_info.get("step_number", state.current_step)

    prompt = PROMPT.format(
        options="\n".join(f"- {structure}" for structure in STRUCTURES),
        question=question,
    )
    answer = get_llm_response(prompt)

    match = re.search(r"\{answer:\s*([a-zA-Z\s]+)\}", answer or "")
    selected = match.group(1).strip() if match else None
    if selected not in STRUCTURES:
        selected = next((s for s in STRUCTURES if selected and s.lower() in selected.lower()), DEFAULT_STRUCTURE)

    state.data_structure[step_num] = selected
    state.add_thought("structurer", f"Structure selected: {selected}")
    return selected


class StructurerAgent(BaseAgent):
    """Determines the structural representation of a unit question."""

    name = "structurer"

    def execute(self, step_info: Dict) -> str:
        self.add_temp_thought("Choosing a structure for the retrieved content...")
        return data_structure_selector(step_info, self.state)
