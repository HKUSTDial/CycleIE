"""Verifier: scores the extracted structure and emits the control signals.

The Verifier is the source of every signal in the loop. It rates completeness,
relevance and accuracy on a 1-5 scale and attributes any problem either to the
retrieved context ("poor retrieval") or to the extraction ("poor extraction").
"""

import logging
from typing import Dict

from ..llm import get_llm_response
from ..utils.json_utils import extract_json_from_text
from .base_agent import BaseAgent

logger = logging.getLogger(__name__)

PROMPT = """Verify the following extracted information against the given criteria:

TASK: {task}

VERIFICATION CRITERIA: {criteria}

EXTRACTED INFORMATION:
{extracted}

RETRIEVED CONTEXT:
{context}

Evaluate the information based on these dimensions:
- Completeness (1-5): Does it provide all the necessary information for the task?
- Relevance (1-5): How relevant is the information to the specific task?
- Accuracy (1-5): Based on internal consistency, does the information seem accurate?
- Does the information need refinement? (Yes/No)
- Is the issue with the extracted information or with the retrieved context?
- What specific improvements are needed?

Respond in JSON format:
{{
    "verification_passed": true/false,
    "completeness": 1-5,
    "relevance": 1-5,
    "accuracy": 1-5,
    "needs_refinement": true/false,
    "issue_source": "extraction" or "retrieval" or "none",
    "refinement_suggestions": "Specific suggestions for improvement"
}}
"""


def _failed(issue_source: str, suggestions: str) -> Dict:
    return {
        "verification_passed": False,
        "completeness": 0,
        "relevance": 0,
        "accuracy": 0,
        "needs_refinement": True,
        "issue_source": issue_source,
        "refinement_suggestions": suggestions,
    }


def information_verifier(step_info: Dict, state) -> Dict:
    """Score the extracted structure and return the verification signal."""
    step_num = step_info.get("step_number", state.current_step)
    extracted = state.extracted_info.get(step_num, "")

    if not extracted:
        result = _failed("retrieval", "Nothing was extracted. Try different search keywords.")
        state.verification_results[step_num] = result
        state.add_thought("verifier", f"Step {step_num} has nothing to verify.")
        return result

    prompt = PROMPT.format(
        task=step_info.get("description", ""),
        criteria=step_info.get("verification_criteria", ""),
        extracted=extracted,
        context=state.retrieved_context.get(step_num, "No context available"),
    )

    result = extract_json_from_text(get_llm_response(prompt))
    if not result:
        result = _failed("extraction", "Could not parse the verification response.")

    result.setdefault("issue_source", "none" if result.get("verification_passed") else "extraction")
    state.verification_results[step_num] = result

    if result.get("verification_passed", False):
        state.add_thought(
            "verifier",
            "Verification passed: completeness {completeness}/5, relevance {relevance}/5, "
            "accuracy {accuracy}/5".format(
                completeness=result.get("completeness", 0),
                relevance=result.get("relevance", 0),
                accuracy=result.get("accuracy", 0),
            ),
        )
    else:
        signal = "poor retrieval" if result.get("issue_source") == "retrieval" else "poor extraction"
        state.add_thought(
            "verifier",
            f"Verification failed on step {step_num}, signal: {signal}. "
            f"Suggestion: {result.get('refinement_suggestions', 'none given')}",
        )

    return result


class VerifierAgent(BaseAgent):
    """Evaluates the extracted structure and emits verification signals."""

    name = "verifier"

    def execute(self, step_info: Dict) -> Dict:
        self.add_temp_thought("Verifying the extracted information...")
        return information_verifier(step_info, self.state)
