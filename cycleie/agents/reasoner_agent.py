"""Reasoner: derives the intermediate answer of a unit question.

Runs once per unit question, over the verified structure rather than over the
raw documents, which is what decouples extraction from reasoning.
"""

import logging
from typing import Dict

from ..llm import get_llm_response
from ..utils.text_utils import language_instruction
from .base_agent import BaseAgent

logger = logging.getLogger(__name__)

PROMPT = """Reason about the following information to address this specific step:

STEP DESCRIPTION: {step_description}

{extracted}

{dependencies}

Based on this information, provide a clear, well-reasoned answer that addresses the step description.
Focus specifically on what this step is asking for, while incorporating any relevant information from dependent steps.
Also, the answer should be concise and to the point.
{language}

ANSWER:
"""

SYNTHESIS_PROMPT = """Synthesize a comprehensive answer to the original query based on all the information gathered:

ORIGINAL QUERY: {query}

INFORMATION GATHERED:
{information}

Craft a well-organized, coherent response that:
1. Directly answers the original query
2. Integrates information from all steps
3. Presents information in a logical flow
4. Cites specific findings from the steps when relevant
5. Acknowledges any limitations or uncertainties in the information

Preserve the structure markers (<Graph START>/<Graph END>, <Tree START>/<Tree END>)
of any structured content you carry over, so that it can still be rendered.

Your answer should be thorough but focused on what is most important to address the query.{language}
"""


def answer_synthesizer(query: str, state) -> str:
    """Combine the per-unit-question answers into the final answer."""
    state.add_thought("reasoner", "Integrating the answers of all steps...")

    sections = []
    for step in state.steps:
        step_num = step.get("step_number", 0)
        answer = state.step_answers.get(step_num) or state.extracted_info.get(step_num, "No information extracted")
        sections.append(f"STEP {step_num}: {step.get('description', '')}\n{answer}")

    prompt = SYNTHESIS_PROMPT.format(
        query=query,
        information="\n\n".join(sections),
        language=language_instruction(query),
    )
    return get_llm_response(prompt)


class ReasonerAgent(BaseAgent):
    """Turns the verified structure into an intermediate answer."""

    name = "reasoner"

    def execute(self, step_info: Dict) -> str:
        self.add_temp_thought("Reasoning over the extracted information...")

        step_num = step_info.get("step_number", 1)
        description = step_info.get("description", "")

        dependencies = ""
        dependent_answers = self.state.get_dependent_answers(step_info)
        if dependent_answers:
            lines = ["INFORMATION FROM DEPENDENT STEPS:"]
            for dep_num, answer in dependent_answers.items():
                dep_description = next(
                    (s.get("description", "") for s in self.state.steps if s.get("step_number") == dep_num), ""
                )
                lines.append(f"Step {dep_num} ({dep_description}): {answer}\n")
            dependencies = "\n".join(lines)

        prompt = PROMPT.format(
            step_description=description,
            extracted=f"EXTRACTED INFORMATION:\n{self.state.extracted_info.get(step_num, 'No information extracted')}",
            dependencies=dependencies,
            language=language_instruction(description),
        )

        answer = get_llm_response(prompt)
        self.state.add_step_answer(step_num, answer)
        self.add_thought(answer)
        return answer
