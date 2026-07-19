#!/usr/bin/env python3
"""Validate the official Radeon Hackathon pull-request title format."""

from __future__ import annotations

import argparse
import re
import sys


TITLE_PATTERN = re.compile(
    r"^Track (?P<track>[123]), (?P<team>[^,\s](?:[^,]*[^,\s])?), (?P<app>[^,\s](?:[^,]*[^,\s])?)$"
)


def validate_title(title: str) -> str | None:
    """Return an error message, or ``None`` when *title* is valid."""
    if "\n" in title or "\r" in title:
        return "title must be a single line"
    if not TITLE_PATTERN.fullmatch(title):
        return (
            "expected exactly: 'Track <1|2|3>, <Team name>, <Application name>'; "
            "use English text and a single comma plus space between fields"
        )
    return None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--title", required=True, help="pull-request title to validate")
    args = parser.parse_args(argv)

    error = validate_title(args.title)
    if error:
        print(f"ERROR: invalid pull-request title: {error}", file=sys.stderr)
        return 1

    print("PR title is valid.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
