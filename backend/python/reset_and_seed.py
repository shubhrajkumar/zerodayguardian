import argparse
import os
import subprocess
import sys


def run(cmd: list[str]) -> None:
    result = subprocess.run(cmd, check=False)
    if result.returncode != 0:
        raise SystemExit(result.returncode)


def main() -> None:
    parser = argparse.ArgumentParser(description="Reset DB, migrate, and seed.")
    parser.add_argument("--force", action="store_true", help="Allow destructive reset.")
    args = parser.parse_args()

    if not args.force:
        print("Refusing to reset without --force.", file=sys.stderr)
        raise SystemExit(2)

    env = os.environ.copy()
    env.setdefault("PY_SKIP_CREATE_TABLES", "true")

    run(["alembic", "downgrade", "base"])
    run(["alembic", "upgrade", "head"])
    run(["python", "seed_data.py", "--reset"])


if __name__ == "__main__":
    main()
