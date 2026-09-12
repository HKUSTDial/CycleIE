"""Workflow controller: ReAct orchestration with MCTS action selection.

The controller drives one unit question at a time. After every action it asks
MCTS which action to take next (Eq. 1-4 of the paper), and overrides that choice
with the intervention mechanism (Eq. 5) whenever a verification deadlock is
detected.
"""

import logging
import math
from typing import TYPE_CHECKING, Dict, List, Optional

from .. import config
from ..core.state import CycleIEState
from ..utils.mcts import MCTSNode
from .base_agent import BaseAgent
from .extractor_agent import ExtractorAgent
from .planner_agent import PlannerAgent, normalize_steps
from .reasoner_agent import ReasonerAgent
from .refiner_agent import RefinerAgent
from .retriever_agent import RetrieverAgent
from .structurer_agent import StructurerAgent
from .verifier_agent import VerifierAgent

if TYPE_CHECKING:  # imported lazily so the controller stays free of index deps
    from ..core.document_manager import DocumentManager

logger = logging.getLogger(__name__)

#: The six core actions of Table 2 plus ``re-extract``, the Extractor's
#: feedback-conditioned second pass triggered by a "poor extraction" signal.
ACTIONS = ["retrieve", "select", "extract", "verify", "re-extract", "refine", "reason"]

#: Transition model T(a): which actions may follow a given action.
TRANSITIONS = {
    "retrieve": ["select"],
    "select": ["extract"],
    "extract": ["verify"],
    "verify": ["retrieve", "re-extract", "refine", "reason"],
    "re-extract": ["verify", "reason"],
    "refine": ["retrieve", "reason"],
    "reason": ["reason"],
}

#: Ablated transition models used for the ablation study of the paper. Without
#: verification the loop degenerates into a single forward pass, and without
#: extraction the Reasoner reads the retrieved segments directly.
VARIANT_TRANSITIONS = {
    "full": TRANSITIONS,
    "wo_verify": {
        "retrieve": ["select"],
        "select": ["extract"],
        "extract": ["reason"],
        "reason": ["reason"],
    },
    "wo_extract": {
        "retrieve": ["reason"],
        "reason": ["reason"],
    },
}


class WorkflowController(BaseAgent):
    """Coordinates the six agents over the unit questions of a task."""

    name = "controller"

    def __init__(self, state: CycleIEState, doc_manager: "DocumentManager", variant: str = "full"):
        super().__init__(state)
        if variant not in VARIANT_TRANSITIONS:
            raise ValueError(f"Unknown variant '{variant}'; expected one of {list(VARIANT_TRANSITIONS)}")
        self.transitions = VARIANT_TRANSITIONS[variant]
        self.planner = PlannerAgent(state)
        self.retriever = RetrieverAgent(state, doc_manager)
        self.structurer = StructurerAgent(state)
        self.extractor = ExtractorAgent(state)
        self.verifier = VerifierAgent(state)
        self.refiner = RefinerAgent(state)
        self.reasoner = ReasonerAgent(state)
        self.result: Optional[str] = None

    # -- top level ----------------------------------------------------------

    def execute(self, query: str, documents: List[str] = None, doc_mode: str = "paths") -> str:
        """Run the full workflow and return the final answer."""
        plan = self.planner.execute(query, documents=documents, doc_mode=doc_mode)
        self.state.steps = normalize_steps(plan["steps"])

        step_idx = 0
        while step_idx < len(self.state.steps):
            self.state.current_step = step_idx + 1
            step = self.state.steps[step_idx]
            self.add_thought(f"**Step {step_idx + 1}: {step.get('description', '')}**")
            self._run_unit_question(step, step_idx, doc_mode)
            step_idx += 1

        last_step = self.state.steps[-1]
        self.result = self.state.step_answers.get(last_step["step_number"])
        if not self.result:
            self.result = self.reasoner.execute(last_step)
        return self.result

    def _run_unit_question(self, step: Dict, step_idx: int, doc_mode: str) -> None:
        """Iterate retrieve/select/extract/verify/reason until the loop closes."""
        action = "retrieve" if step.get("requires_document", False) else "reason"

        for _ in range(config.MAX_ACTIONS_PER_STEP):
            step[f"{action}_attempts"] = step.get(f"{action}_attempts", 0) + 1
            outcome = self._execute_action(action, step, doc_mode)

            if action == "reason":
                return

            if action == "refine":
                # The unit question was rewritten; continue on the new one, but
                # carry the refinement budget over so it cannot be reset away.
                spent = self._refinement_attempts(step)
                step = outcome or step
                step["refine_attempts"] = spent
                self.state.steps[step_idx] = step
                action = "retrieve" if step.get("requires_document", False) else "reason"
                continue

            action = self._next_action(step, action)
            if action is None:
                return

    def _execute_action(self, action: str, step: Dict, doc_mode: str):
        if action == "retrieve":
            return self.retriever.execute(step, doc_mode=doc_mode)
        if action == "select":
            return self.structurer.execute(step)
        if action == "extract":
            return self.extractor.execute(step)
        if action == "verify":
            return self.verifier.execute(step)
        if action == "re-extract":
            return self.extractor.refine(step)
        if action == "refine":
            return self.refiner.execute(step, ACTIONS)
        if action == "reason":
            return self.reasoner.execute(step)
        raise ValueError(f"Unknown action: {action}")

    # -- action selection ---------------------------------------------------

    def _next_action(self, step: Dict, current_action: str) -> Optional[str]:
        """Eq. 5: the intervention mechanism overrides MCTS when it fires."""
        override = self._intervention(step)
        if override is not None:
            self.add_thought(f"Verification deadlock detected, switching to '{override}'.")
            return override
        return self._mcts_search(step, current_action)

    def _intervention(self, step: Dict) -> Optional[str]:
        if not self._cycle_detected(step):
            return None

        if self._verification(step).get("verification_passed", False):
            return "reason"

        if self._total_attempts(step) > config.MAX_ATTEMPTS_PER_STEP:
            if self._refinement_attempts(step) < config.MAX_HIGH_COST_REFINEMENTS:
                return "refine"
            return "reason"

        return None

    def _mcts_search(self, step: Dict, current_action: str) -> Optional[str]:
        """Eq. 1-4: simulate from the current state and return argmax_a N(s, a)."""
        candidates = self._valid_actions(step, current_action)
        if not candidates:
            # Every continuation is exhausted: answer with what we have.
            return "reason"

        root = MCTSNode(state={"action": current_action, "depth": 0})
        for action in candidates:
            root.add_child({"action": action, "depth": 1})

        for _ in range(config.MCTS_SIMULATIONS):
            node = self._select(root)
            if node.visits > 0 and node.state["depth"] < config.MAX_SEARCH_DEPTH:
                node = self._expand(node, step)
            self._backpropagate(node, self._simulate(node, step))

        # Eq. 5 (best action selection): the most visited child of the root.
        return max(root.children, key=lambda child: child.visits).state["action"]

    def _select(self, node: MCTSNode) -> MCTSNode:
        """Descend by UCT, visiting every unvisited child first (UCT = +inf)."""
        while node.children:
            unvisited = next((child for child in node.children if child.visits == 0), None)
            if unvisited is not None:
                return unvisited
            node = max(node.children, key=lambda child: self._uct(child, node))
        return node

    @staticmethod
    def _uct(child: MCTSNode, parent: MCTSNode) -> float:
        exploration = math.sqrt(math.log(parent.visits) / child.visits)
        return child.mean_value + config.EXPLORATION_CONSTANT * exploration

    def _expand(self, node: MCTSNode, step: Dict) -> MCTSNode:
        """Eq. 2: add the children allowed by T(a) and the ReAct validity check."""
        if not node.children:
            for action in self._valid_actions(step, node.state["action"]):
                node.add_child({"action": action, "depth": node.state["depth"] + 1})
        return node.children[0] if node.children else node

    def _backpropagate(self, node: Optional[MCTSNode], reward: float) -> None:
        """Eq. 4: N(v) <- N(v) + 1 and Q(v) <- Q(v) + R along the path."""
        while node is not None:
            node.update(reward)
            node = node.parent

    def _valid_actions(self, step: Dict, action: str) -> List[str]:
        """A_valid = {a' in T(a) : Valid_ReAct(a', s)}."""
        return [
            candidate for candidate in self.transitions.get(action, [])
            if self._is_valid(candidate, step)
        ]

    def _is_valid(self, action: str, step: Dict) -> bool:
        if action == "retrieve":
            return self._should_retrieve_more(step)
        if action in ("re-extract", "refine"):
            return self._refinement_attempts(step) < config.MAX_HIGH_COST_REFINEMENTS
        return True

    # -- reward -------------------------------------------------------------

    def _simulate(self, node: MCTSNode, step: Dict) -> float:
        """Eq. 3: R(a, s) = R_base + R_verify - R_cycle - R_penalty."""
        action = node.state["action"]
        verification = self._verification(step)

        r_base = self._action_affinity(action, step, verification)
        r_verify = self._verification_score(verification)
        r_cycle = min(
            config.MAX_CYCLE_PENALTY,
            config.CYCLE_PENALTY_PER_ATTEMPT * self._total_attempts(step),
        )
        r_penalty = config.ACTION_PENALTIES.get(action, 0.0)

        return r_base + r_verify - r_cycle - r_penalty

    def _action_affinity(self, action: str, step: Dict, verification: Dict) -> float:
        """R_base: how well the action fits the current reasoning state."""
        step_idx = self.state.current_step
        has_docs = bool(self.state.retrieved_docs.get(step_idx))
        has_structure = bool(self.state.data_structure.get(step_idx))
        has_extraction = bool(self.state.extracted_info.get(step_idx))
        verified = bool(verification)
        passed = verification.get("verification_passed", False)
        issue = verification.get("issue_source", "")

        strong, weak = config.AFFINITY_STRONG, config.AFFINITY_WEAK
        reward = config.BASE_REWARD

        if action == "retrieve":
            if not has_docs:
                reward += strong
            elif issue == "retrieval":
                reward += weak
            if passed or step.get("retrieve_attempts", 0) >= config.MAX_RETRIEVE_ATTEMPTS:
                reward -= strong
        elif action == "select":
            reward += strong if has_docs and not has_structure else -strong
        elif action == "extract":
            if has_structure and not has_extraction:
                reward += strong
            elif passed:
                reward -= strong
        elif action == "verify":
            if has_extraction and not verified:
                reward += strong
            elif passed:
                reward -= weak
        elif action == "re-extract":
            if verified and not passed and issue == "extraction":
                reward += strong
            elif not verified or passed:
                reward -= strong
        elif action == "refine":
            if self._cycle_detected(step) and not passed:
                reward += weak
            else:
                reward -= strong
        elif action == "reason":
            if passed:
                reward += strong
            elif self._total_attempts(step) > config.MAX_ATTEMPTS_PER_STEP:
                reward += weak
            elif not has_extraction:
                reward -= weak

        return reward

    @staticmethod
    def _verification_score(verification: Dict) -> float:
        """R_verify = (c + r + a) / 15, i.e. the mean of the three 1-5 scores."""
        total = (
            verification.get("completeness", 0)
            + verification.get("relevance", 0)
            + verification.get("accuracy", 0)
        )
        return total / (3 * config.VERIFIER_SCALE_MAX)

    # -- state predicates ---------------------------------------------------

    def _verification(self, step: Dict) -> Dict:
        return self.state.verification_results.get(self.state.current_step, {})

    @staticmethod
    def _total_attempts(step: Dict) -> int:
        """N_total: retrieve, verify and refine attempts on this unit question."""
        return sum(step.get(f"{action}_attempts", 0) for action in ("retrieve", "verify", "refine"))

    @staticmethod
    def _refinement_attempts(step: Dict) -> int:
        """N_refine: the high-cost actions spent on this unit question."""
        return step.get("re-extract_attempts", 0) + step.get("refine_attempts", 0)

    @staticmethod
    def _cycle_detected(step: Dict) -> bool:
        """C: the unit question has already failed verification more than once."""
        return step.get("verify_attempts", 0) > 1

    def _should_retrieve_more(self, step: Dict) -> bool:
        """Whether the Verifier considers the current context insufficient."""
        if step.get("retrieve_attempts", 0) >= config.MAX_RETRIEVE_ATTEMPTS:
            return False

        verification = self._verification(step)
        if not verification:
            return not self.state.retrieved_docs.get(self.state.current_step)
        if verification.get("verification_passed", False):
            return False
        if verification.get("issue_source") == "retrieval":
            return True

        context_quality = (verification.get("completeness", 0) + verification.get("relevance", 0)) / 2
        return context_quality < config.RETRIEVAL_TRIGGER_THRESHOLD
