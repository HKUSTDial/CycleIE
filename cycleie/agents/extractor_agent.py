"""Extractor: turns retrieved segments into the selected structure.

On a "poor extraction" signal from the Verifier the Extractor re-runs, this time
conditioned on the verification feedback, instead of discarding the attempt.
"""

import logging
import re
from typing import Dict

from ..llm import get_llm_response
from ..utils.text_utils import language_instruction
from .base_agent import BaseAgent
from .structurer_agent import DEFAULT_STRUCTURE

logger = logging.getLogger(__name__)

EXTRACT_PROMPT = """Extract the most relevant information from these document information and transform into the following structure:

STRUCTURE: {structure}

TASK: {task}

DOCUMENT INFORMATION:
{documents}

EXTRACTION GUIDELINES:
1. Focus specifically on information that directly addresses the task
2. Extract key facts, figures, quotes, and findings
3. Maintain accuracy - don't add information not present in the documents
4. Note any contradictions or uncertainties in the documents
5. Organize the extracted information logically
6. If "STRUCTURE" is a "Graph" or a "Tree," return a tuple of two or three elements.
{structure_format}
EXTRACTED INFORMATION:
"""

REFINE_PROMPT = """Refine the previously extracted information based on the verification feedback:

TASK: {task}

ORIGINAL EXTRACTED INFORMATION:
{extracted}

VERIFICATION FEEDBACK:
- Completeness: {completeness}/5
- Relevance: {relevance}/5
- Accuracy: {accuracy}/5
- Suggested improvements: {suggestions}

SOURCE DOCUMENT SEGMENTS:
{documents}
{structure_format}
REFINED INFORMATION (address all the issues mentioned in the feedback):{language}
"""

# Graphs and trees are emitted between markers so that a client can render them
# without having to guess where the structured part of the answer starts.
STRUCTURE_FORMATS = {
    "Graph": """
OUTPUT FORMAT: list the relations as (Subject, Predicate, Object) triplets, one
per line, between the markers <Graph START> and <Graph END>. Use plain entity
names without numbering, and only include relations stated in the documents.
""",
    "Tree": """
OUTPUT FORMAT: list the hierarchy as (Parent, relationship, Child) triplets, one
per line, between the markers <Tree START> and <Tree END>. Use relationships
such as has_child, contains or belongs_to.
""",
    "Table": """
OUTPUT FORMAT: return a table with explicit column headers, either as HTML or as
structured JSON.
""",
}

TRIPLET_PATTERN = re.compile(r"^\(\s*[^(),]+,\s*[^(),]+,\s*[^(),]+\s*\)$", re.MULTILINE)


def _wrap_triplets(content: str, structure: str) -> str:
    """Add the structure markers when the model produced triplets without them.

    Content that does not contain triplets is returned untouched; nothing is
    invented to satisfy the format.
    """
    if structure not in ("Graph", "Tree"):
        return content
    start, end = f"<{structure} START>", f"<{structure} END>"
    if start in content and end in content:
        return content

    triplets = TRIPLET_PATTERN.findall(content or "")
    if not triplets:
        return content

    prose = TRIPLET_PATTERN.sub("", content).strip()
    block = "\n".join([start, *triplets, end])
    return f"{prose}\n\n{block}" if prose else block


def information_extractor(step_info: Dict, state) -> str:
    """Extract the structured content for the current unit question."""
    step_num = step_info.get("step_number", state.current_step)
    structure = state.data_structure.get(step_num) or DEFAULT_STRUCTURE
    documents = state.retrieved_docs.get(step_num, "")

    if not documents or documents == "Document retrieval not needed for this step.":
        state.add_thought("extractor", f"Step {step_num} has no retrieved content to extract from.")
        return "No document content available for extraction."

    prompt = EXTRACT_PROMPT.format(
        structure=structure,
        task=step_info.get("description", ""),
        documents=documents,
        structure_format=STRUCTURE_FORMATS.get(structure, ""),
    )
    extracted = _wrap_triplets(get_llm_response(prompt), structure)

    state.extracted_info[step_num] = extracted
    state.add_thought("extractor", extracted)
    return extracted


def information_refiner(step_info: Dict, state) -> str:
    """Re-extract under the Verifier's feedback ("poor extraction" signal)."""
    step_num = step_info.get("step_number", state.current_step)
    extracted = state.extracted_info.get(step_num, "")
    verification = state.verification_results.get(step_num, {})
    structure = state.data_structure.get(step_num) or DEFAULT_STRUCTURE

    if not verification.get("needs_refinement", False):
        return extracted

    state.add_thought("extractor", "Re-extracting under the verification feedback...")

    prompt = REFINE_PROMPT.format(
        task=step_info.get("description", ""),
        extracted=extracted,
        completeness=verification.get("completeness", "N/A"),
        relevance=verification.get("relevance", "N/A"),
        accuracy=verification.get("accuracy", "N/A"),
        suggestions=verification.get("refinement_suggestions", "No specific suggestions"),
        documents=state.retrieved_docs.get(step_num, ""),
        structure_format=STRUCTURE_FORMATS.get(structure, ""),
        language=language_instruction(step_info.get("description", "")),
    )
    refined = _wrap_triplets(get_llm_response(prompt), structure)

    state.extracted_info[step_num] = refined
    state.add_thought("extractor", refined)
    return refined


class ExtractorAgent(BaseAgent):
    """Converts retrieved segments into the structure chosen by the Structurer."""

    name = "extractor"

    def execute(self, step_info: Dict) -> str:
        self.add_temp_thought("Extracting the key information from the documents...")
        return information_extractor(step_info, self.state)

    def refine(self, step_info: Dict) -> str:
        return information_refiner(step_info, self.state)
