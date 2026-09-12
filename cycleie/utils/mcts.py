"""Monte Carlo Tree Search node."""

from dataclasses import dataclass, field
from typing import Any, List, Optional


@dataclass
class MCTSNode:
    """A node ``v`` of the search tree: an action taken in a reasoning state."""

    state: Any
    parent: Optional["MCTSNode"] = None
    children: List["MCTSNode"] = field(default_factory=list)
    visits: int = 0
    value: float = 0.0

    def add_child(self, child_state: Any) -> "MCTSNode":
        child = MCTSNode(state=child_state, parent=self)
        self.children.append(child)
        return child

    def update(self, reward: float) -> None:
        """Backpropagation update: N(v) <- N(v) + 1, Q(v) <- Q(v) + R."""
        self.visits += 1
        self.value += reward

    @property
    def mean_value(self) -> float:
        """Q(v) / N(v), the exploitation term of UCT."""
        return self.value / self.visits if self.visits else 0.0
