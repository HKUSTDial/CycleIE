"""Answer one question over a few local documents and print the reasoning trail.

Usage::

    python examples/quickstart.py --docs report.pdf notes.md --query "..."
"""

import argparse

from cycleie import run_cycleie, stream_cycleie
from cycleie.core.workflow import FINAL_ANSWER_MARKER


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--docs", nargs="+", required=True, help="Paths of the documents to analyse")
    parser.add_argument("--query", required=True, help="The analytical question to answer")
    parser.add_argument("--model", default=None, help="Backbone model; defaults to the configured one")
    parser.add_argument("--stream", action="store_true", help="Print the thoughts as they are produced")
    args = parser.parse_args()

    if args.stream:
        for chunk in stream_cycleie(query=args.query, documents=args.docs, model=args.model):
            print(chunk)
        return

    result = run_cycleie(
        query=args.query,
        documents=args.docs,
        model=args.model,
        callback=lambda thought, temporary=False: print(thought),
    )
    print(f"\n{FINAL_ANSWER_MARKER}\n{result['answer']}")


if __name__ == "__main__":
    main()
