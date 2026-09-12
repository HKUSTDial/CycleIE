"""Controller hyper-parameters of CycleIE.

All values are fixed across datasets and correspond one-to-one to the symbols
used in the paper (Section 3.3 and Appendix "Parameter Settings").
"""

import math

# --- MCTS search (Eq. 1) ---------------------------------------------------
MCTS_SIMULATIONS = 10
MAX_SEARCH_DEPTH = 3
EXPLORATION_CONSTANT = math.sqrt(2)  # alpha

# --- Reward, R = R_base + R_verify - R_cycle - R_penalty (Eq. 3) -----------
BASE_REWARD = 0.5  # R_base before state-conditioned adjustment
AFFINITY_STRONG = 0.3  # adjustment applied when an action clearly fits the state
AFFINITY_WEAK = 0.2  # adjustment applied when an action plausibly fits the state

CYCLE_PENALTY_PER_ATTEMPT = 0.1  # R_cycle grows by this much per repeated attempt
MAX_CYCLE_PENALTY = 0.5

# R_penalty: operational cost of the two high-cost actions. These are the
# values the paper's appendix lists as 0.2 for "refine" (re-extraction under
# verifier feedback) and 0.3 for "replan" (reformulating the unit question).
ACTION_PENALTIES = {"re-extract": 0.2, "refine": 0.3}

# --- Intervention mechanism for anomalies (Eq. 5) --------------------------
MAX_ATTEMPTS_PER_STEP = 6  # mu: retrieve/verify/refine attempts on one unit question
MAX_HIGH_COST_REFINEMENTS = 2  # eta: re-extract/refine actions within one loop

# --- Action validity constraints (Eq. 2) -----------------------------------
MAX_RETRIEVE_ATTEMPTS = 2
MAX_REFINE_ATTEMPTS = 2
MAX_ACTIONS_PER_STEP = 40

# --- Verifier thresholds ---------------------------------------------------
# Scores are on a 1-5 scale. Re-retrieval is triggered when the average of
# completeness and relevance drops below this value.
RETRIEVAL_TRIGGER_THRESHOLD = 2.0
VERIFIER_SCALE_MAX = 5

# --- Backbone models -------------------------------------------------------
# Every generation agent uses the same backbone; only the long-context
# retriever falls back to a long-context model when a document does not fit.
DEFAULT_MODEL = "qwen2-72b-instruct"
LONG_CONTEXT_MODEL = "qwen-long"

# Documents shorter than this (English words + Chinese characters) are passed
# to the extractor as-is instead of being compressed by the long-context model.
RETRIEVER_DIRECT_PASS_LENGTH = 50_000
