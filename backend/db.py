from contextlib import contextmanager
from typing import Iterator

from psycopg import Connection
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from config import SUPABASE_DB_URL

# max_idle + max_lifetime recycle stale connections (Supabase silently kills
# idle ones); check=check_connection runs a 1-query liveness probe before
# handing a connection out, so we never serve a dead handle.
_pool = ConnectionPool(
    conninfo=SUPABASE_DB_URL,
    min_size=1,
    max_size=8,
    max_idle=300,        # close connections idle > 5 min
    max_lifetime=1800,   # recycle every 30 min regardless
    check=ConnectionPool.check_connection,
    kwargs={"row_factory": dict_row, "autocommit": False},
)


@contextmanager
def get_conn() -> Iterator[Connection]:
    with _pool.connection() as conn:
        yield conn


def close_pool() -> None:
    _pool.close()
