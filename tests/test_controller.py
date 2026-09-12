"""Tests for the MCTS action selection described in Section 3 of the paper."""

import unittest

from cycleie import config
from cycleie.agents.controller import WorkflowController
from cycleie.core.state import CycleIEState
from cycleie.utils.mcts import MCTSNode


def make_controller(variant: str = "full") -> WorkflowController:
    state = CycleIEState()
    state.current_step = 1
    return WorkflowController(state, doc_manager=None, variant=variant)


class MCTSNodeTest(unittest.TestCase):
    def test_backpropagation_accumulates_visits_and_value(self):
        node = MCTSNode(state={"action": "verify", "depth": 0})
        child = node.add_child({"action": "reason", "depth": 1})

        child.update(0.4)
        child.update(0.6)

        self.assertEqual(child.visits, 2)
        self.assertAlmostEqual(child.value, 1.0)
        self.assertAlmostEqual(child.mean_value, 0.5)

    def test_mean_value_of_unvisited_node_is_zero(self):
        self.assertEqual(MCTSNode(state={}).mean_value, 0.0)


class RewardTest(unittest.TestCase):
    def test_verification_score_is_the_mean_of_the_three_criteria(self):
        controller = make_controller()
        score = controller._verification_score({"completeness": 5, "relevance": 5, "accuracy": 5})
        self.assertAlmostEqual(score, 1.0)
        self.assertAlmostEqual(
            controller._verification_score({"completeness": 3, "relevance": 3, "accuracy": 3}), 0.6
        )

    def test_cycle_penalty_is_capped(self):
        controller = make_controller()
        node = MCTSNode(state={"action": "reason", "depth": 1})

        moderate = controller._simulate(node, {"retrieve_attempts": 5, "verify_attempts": 5})
        excessive = controller._simulate(node, {"retrieve_attempts": 50, "verify_attempts": 50})

        self.assertAlmostEqual(moderate, excessive)

    def test_reasoning_outscores_re_extraction_once_verification_passes(self):
        controller = make_controller()
        controller.state.verification_results[1] = {
            "completeness": 5, "relevance": 5, "accuracy": 5, "verification_passed": True,
        }
        reason = controller._simulate(MCTSNode(state={"action": "reason", "depth": 1}), {})
        re_extract = controller._simulate(MCTSNode(state={"action": "re-extract", "depth": 1}), {})
        self.assertGreater(reason, re_extract)


class ActionSelectionTest(unittest.TestCase):
    def test_passed_verification_leads_to_reasoning(self):
        controller = make_controller()
        controller.state.retrieved_docs[1] = "segments"
        controller.state.data_structure[1] = {"structure_type": "Table"}
        controller.state.extracted_info[1] = "| a | b |"
        controller.state.verification_results[1] = {
            "completeness": 5, "relevance": 5, "accuracy": 5, "verification_passed": True,
        }
        self.assertEqual(controller._next_action({"verify_attempts": 1}, "verify"), "reason")

    def test_extraction_signal_leads_to_re_extraction(self):
        controller = make_controller()
        controller.state.retrieved_docs[1] = "segments"
        controller.state.data_structure[1] = {"structure_type": "Table"}
        controller.state.extracted_info[1] = "| a | b |"
        controller.state.verification_results[1] = {
            "completeness": 4, "relevance": 4, "accuracy": 2,
            "verification_passed": False, "issue_source": "extraction",
        }
        step = {"retrieve_attempts": 1, "verify_attempts": 1}
        self.assertEqual(controller._next_action(step, "verify"), "re-extract")

    def test_retrieval_signal_leads_to_retrieval(self):
        controller = make_controller()
        controller.state.retrieved_docs[1] = "segments"
        controller.state.verification_results[1] = {
            "completeness": 1, "relevance": 1, "accuracy": 3,
            "verification_passed": False, "issue_source": "retrieval",
        }
        step = {"retrieve_attempts": 1, "verify_attempts": 1}
        self.assertEqual(controller._next_action(step, "verify"), "retrieve")

    def test_deadlock_triggers_question_refinement(self):
        controller = make_controller()
        controller.state.verification_results[1] = {
            "completeness": 1, "relevance": 1, "accuracy": 1, "verification_passed": False,
        }
        step = {"retrieve_attempts": 3, "verify_attempts": 3, "refine_attempts": 1}
        self.assertGreater(controller._total_attempts(step), config.MAX_ATTEMPTS_PER_STEP)
        self.assertEqual(controller._next_action(step, "verify"), "refine")

    def test_refinement_budget_is_bounded(self):
        controller = make_controller()
        controller.state.verification_results[1] = {
            "completeness": 1, "relevance": 1, "accuracy": 1, "verification_passed": False,
        }
        step = {
            "retrieve_attempts": 3,
            "verify_attempts": 3,
            "refine_attempts": config.MAX_HIGH_COST_REFINEMENTS,
        }
        self.assertEqual(controller._next_action(step, "verify"), "reason")

    def test_every_action_can_always_continue(self):
        controller = make_controller()
        for action in ("retrieve", "select", "extract", "verify", "re-extract", "refine"):
            self.assertIsNotNone(controller._next_action({}, action), action)

    def test_ablations_skip_their_agent(self):
        self.assertNotIn("verify", make_controller("wo_verify").transitions)
        self.assertNotIn("extract", make_controller("wo_extract").transitions)

    def test_unknown_variant_is_rejected(self):
        with self.assertRaises(ValueError):
            make_controller("wo_everything")


if __name__ == "__main__":
    unittest.main()
