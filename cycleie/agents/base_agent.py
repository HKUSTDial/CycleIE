"""Common behaviour of the CycleIE agents."""

from abc import ABC, abstractmethod

from ..core.state import CycleIEState


class BaseAgent(ABC):
    """Base class for every agent in the iterative extraction loop."""

    #: Tag used when this agent writes to the thought trail.
    name = "controller"

    def __init__(self, state: CycleIEState):
        self.state = state

    @abstractmethod
    def execute(self, *args, **kwargs):
        """Run the action this agent is responsible for."""

    def add_thought(self, thought: str) -> None:
        self.state.add_thought(self.name, thought)

    def add_temp_thought(self, thought: str) -> None:
        """Emit a transient status message for the streaming view."""
        self.state.add_thought(self.name, thought, temporary=True)
