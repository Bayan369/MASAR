"""Explicit operator-only bootstrap. No network/changes occur merely on import."""

import argparse
from uuid import UUID
from app.config import get_settings
from app.services.supabase import Supabase


def main():
    parser = argparse.ArgumentParser(
        description="Provision an existing Supabase Auth user as the initial company admin. Writes hosted data only with explicit operator execution."
    )
    parser.add_argument("--admin-user-id", type=UUID, required=True)
    parser.add_argument("--company-name", required=True)
    parser.add_argument("--display-name", required=True)
    parser.add_argument("--confirm-provision", action="store_true", required=True)
    args = parser.parse_args()
    if not args.company_name.strip() or not args.display_name.strip():
        parser.error("Names must not be empty")
    try:
        Supabase(get_settings(), trusted=True).rpc(
            "bootstrap_company",
            {
                "admin_id": str(args.admin_user_id),
                "company_name": args.company_name.strip(),
                "display_name": args.display_name.strip(),
            },
        )
    except Exception:
        print(
            "Provisioning failed; review server configuration and existing membership. No credential values are printed."
        )
        return 1
    print("Company and administrator membership provisioned.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
