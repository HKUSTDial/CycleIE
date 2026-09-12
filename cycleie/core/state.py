"""Shared reasoning state of one CycleIE run."""

import logging
from typing import Callable, Dict, Optional

logger = logging.getLogger(__name__)

#: Prefix of a transient status message, so a streaming client can tell it apart
#: from a thought that belongs in the permanent trail.
TEMPORARY_TAG = "[TEMP]"

# Tags prefixed to each thought so that a client can route them to the right
# panel of the streaming view.
AGENT_TAGS = {
    "planner": "[PLAN]",
    "retriever": "[RETRIEVE]",
    "structurer": "[STRUCTURE]",
    "extractor": "[EXTRACT]",
    "verifier": "[VERIFY]",
    "refiner": "[REFINE]",
    "reasoner": "[REASON]",
    "controller": "[DECISION]",
}


class CycleIEState:
    """Reasoning state ``s`` shared by all agents.

    It holds the unit questions produced by the Planner and, per unit question,
    the retrieved segments, the selected structure, the extracted structure,
    the verification feedback and the intermediate answer.
    """

    def __init__(self, callback: Optional[Callable[..., None]] = None):
        self.current_step = 0
        self.steps = []
        self.retrieved_docs: Dict[int, str] = {}
        self.retrieved_context: Dict[int, str] = {}
        self.data_structure: Dict[int, str] = {}
        self.extracted_info: Dict[int, str] = {}
        self.verification_results: Dict[int, Dict] = {}
        self.step_answers: Dict[int, str] = {}
        self.thought_process = []
        self.callback = callback

    def add_thought(self, agent: str, thought: str, temporary: bool = False) -> None:
        """Record a thought and forward it to the streaming callback.

        Temporary thoughts are transient status messages ("retrieving...") that
        a client is expected to replace as soon as the next thought arrives.
        """
        tag = TEMPORARY_TAG if temporary else AGENT_TAGS.get(agent, "")
        entry = f"{tag} {thought}".strip()
        if not temporary:
            self.thought_process.append(entry)

        if self.callback is None:
            return
        try:
            self.callback(entry, temporary=temporary)
        except TypeError:
            self.callback(entry)
        except Exception as error:  # a failing client must not stop the workflow
            logger.error("Thought callback raised: %s", error)

    def get_thought_trail(self) -> str:
        return "\n".join(self.thought_process)

    def add_step_answer(self, step_num: int, answer: str) -> None:
        self.step_answers[step_num] = answer

    def get_dependent_answers(self, step_info: Dict) -> Dict[int, str]:
        """Answers of the unit questions the given one depends on."""
        answers = {}
        for dependency in step_info.get("depends_on_steps", []):
            if dependency in self.step_answers:
                answers[dependency] = self.step_answers[dependency]
            else:
                logger.warning("Step %s depends on step %s, which has no answer yet",
                               step_info.get("step_number"), dependency)
        return answers
