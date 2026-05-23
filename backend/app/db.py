from contextlib import contextmanager
from psycopg import connect
from psycopg.rows import dict_row

from backend.app.core.config import get_settings


@contextmanager
def get_conn():
    conn = connect(get_settings().database_url, row_factory=dict_row)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def fetch_all(query: str, params: tuple = ()) -> list[dict]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            return list(cur.fetchall())


def fetch_one(query: str, params: tuple = ()) -> dict | None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            return cur.fetchone()


def execute(query: str, params: tuple = ()) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
