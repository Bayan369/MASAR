"""Run real PostgreSQL/RLS checks in a disposable, network-isolated container.

No database URL, Supabase token or remote project is accepted. Only the managed
local Docker socket is used. No seed data survives test transaction rollback.
"""

from pathlib import Path
import argparse
import re
import os
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
IMAGE = "pgvector/pgvector@sha256:3e8b3adfd27b5707128f60956f62a793c3c9326ea8cfaf0eab7adccb5d700b21"
EXPECTED_CHECKS = 81
DOCKER = ["docker", "--host=unix:///var/run/docker.sock"]
ENV = {
    k: v
    for k, v in os.environ.items()
    if k
    not in {
        "DOCKER_HOST",
        "DOCKER_CONTEXT",
        "DOCKER_TLS",
        "DOCKER_TLS_VERIFY",
        "DOCKER_CERT_PATH",
    }
}


def docker(
    *args: str, sql: str | None = None, check: bool = True
) -> subprocess.CompletedProcess:
    return subprocess.run(
        [*DOCKER, *args],
        env=ENV,
        input=sql,
        text=True,
        capture_output=True,
        check=check,
    )


def main(image: str = IMAGE) -> None:
    if not re.fullmatch(r"pgvector/pgvector@sha256:[0-9a-f]{64}", image):
        raise ValueError("Only an exact official pgvector image digest is accepted")
    name = "masar-rls-" + uuid.uuid4().hex[:12]
    # Refuse a network pull here: provision the exact image digest explicitly.
    docker("image", "inspect", image)
    started = False
    try:
        docker(
            "run",
            "--detach",
            "--pull=never",
            "--name",
            name,
            "--network",
            "none",
            "--tmpfs",
            "/var/lib/postgresql/data:rw,size=256m",
            "--shm-size",
            "128m",
            "-e",
            "POSTGRES_HOST_AUTH_METHOD=trust",
            image,
        )
        started = True
        for _ in range(60):
            if (
                docker(
                    "exec",
                    name,
                    "pg_isready",
                    "-h",
                    "127.0.0.1",
                    "-U",
                    "postgres",
                    check=False,
                ).returncode
                == 0
            ):
                break
            time.sleep(0.5)
        else:
            raise RuntimeError("Disposable local PostgreSQL failed to become ready")

        def execute(sql: str) -> str:
            result = docker(
                "exec",
                "-i",
                name,
                "psql",
                "-X",
                "-U",
                "postgres",
                "-d",
                "postgres",
                "-v",
                "ON_ERROR_STOP=1",
                "-qAt",
                sql=sql,
            )
            return result.stdout

        execute((ROOT / "supabase/tests/harness/local_auth_bootstrap.sql").read_text())
        policy_oid = None
        policy_query = (
            "select p.oid from pg_policy p join pg_class c on c.oid=p.polrelid "
            "join pg_namespace n on n.oid=c.relnamespace "
            "where n.nspname='public' and c.relname='messages' and p.polname='messages_read';"
        )
        for path in sorted((ROOT / "supabase/migrations").glob("*.sql")):
            execute(path.read_text())
            print("Migration applied locally:", path.name, flush=True)
            if path.name.startswith("20261102000200"):
                policy_oid = execute(policy_query).strip()
                result = execute((ROOT / "supabase/tests/tenant_rls.sql").read_text())
                summaries = [
                    line
                    for line in result.splitlines()
                    if line.startswith("TESTS_PASSED=")
                ]
                if (
                    len(summaries) != 1
                    or int(summaries[0].split("=")[1]) != EXPECTED_CHECKS
                ):
                    raise RuntimeError(
                        f"Expected exactly {EXPECTED_CHECKS} completed SQL assertions"
                    )
                print(summaries[0], flush=True)

            if path.name.startswith("20261102000300"):
                if not policy_oid or execute(policy_query).strip() != policy_oid:
                    raise RuntimeError(
                        "Source-revocation migration replaced the existing policy"
                    )
                print(
                    "PASS: existing messages_read policy preserved in place.",
                    flush=True,
                )

            if path.name.startswith("20261102000100"):
                closed = execute(
                    "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace "
                    "where n.nspname='public' and c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity "
                    "and not has_table_privilege('anon',c.oid,'SELECT') "
                    "and not has_table_privilege('authenticated',c.oid,'SELECT') "
                    "and not has_table_privilege('authenticated',c.oid,'INSERT');"
                ).strip()
                if closed != "7":
                    raise RuntimeError("Tables are not fail-closed between migrations")
                print(
                    "PASS: all seven tables fail closed before policy migration.",
                    flush=True,
                )
        original = (ROOT / "supabase/tests/tenant_rls.sql").read_text()
        product = (
            original.split("-- Catalog checks")[0]
            + (ROOT / "supabase/tests/product_rls.sql").read_text()
        )
        result = execute(product)
        summaries = [
            line for line in result.splitlines() if line.startswith("TESTS_PASSED=")
        ]
        if summaries != ["TESTS_PASSED=35"]:
            raise RuntimeError("Expected exactly 35 product SQL assertions")
        print(summaries[0], flush=True)
        remaining = execute(
            "select sum(n) from ("
            "select count(*) n from public.companies union all select count(*) from public.profiles "
            "union all select count(*) from public.departments union all select count(*) from public.documents "
            "union all select count(*) from public.document_chunks union all select count(*) from public.conversations "
            "union all select count(*) from public.messages) counts;"
        ).strip()
        if remaining != "0":
            raise RuntimeError("Test data did not roll back")
        print("Rollback verified: all seven application tables empty.", flush=True)
        versions = execute(
            "select current_setting('server_version') || ' / pgvector ' || extversion "
            "from pg_extension where extname='vector';"
        ).strip()
        print(
            "PASS: PostgreSQL " + versions + "; no network or hosted database access.",
            flush=True,
        )
    finally:
        if started:
            docker("rm", "--force", "--volumes", name)
            print("Disposable test container removed.", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--image",
        default=IMAGE,
        help="Exact cached official image digest; never a remote DB URL",
    )
    args = parser.parse_args()
    try:
        main(args.image)
    except subprocess.CalledProcessError as error:
        print(error.stdout or "", end="")
        print(error.stderr or "", end="")
        raise SystemExit(error.returncode)
