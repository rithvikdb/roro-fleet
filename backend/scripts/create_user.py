import argparse

from backend.app.db import fetch_one
from backend.app.security import hash_password


def main():
    parser = argparse.ArgumentParser(description="Create or update a RORO Fleet user.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--name", default="")
    parser.add_argument("--role", default="admin")
    args = parser.parse_args()

    salt, password_hash = hash_password(args.password)
    row = fetch_one(
        """
        insert into app_users (email, full_name, role, password_salt, password_hash)
        values (%s, %s, %s, %s, %s)
        on conflict (email) do update set
          full_name = excluded.full_name,
          role = excluded.role,
          password_salt = excluded.password_salt,
          password_hash = excluded.password_hash,
          active = true
        returning id, email, role
        """,
        (args.email, args.name, args.role, salt, password_hash),
    )
    print(f"User ready: {row['email']} ({row['role']})")


if __name__ == "__main__":
    main()
