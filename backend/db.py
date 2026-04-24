from contextlib import contextmanager
from typing import Iterator

from psycopg import Connection
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from config import SUPABASE_DB_URL

_pool = ConnectionPool(
    conninfo=SUPABASE_DB_URL,
    min_size=1,
    max_size=8,
    kwargs={"row_factory": dict_row, "autocommit": False},
)


@contextmanager
def get_conn() -> Iterator[Connection]:
    with _pool.connection() as conn:
        yield conn


def close_pool() -> None:
    _pool.close()
