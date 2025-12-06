from typing import Optional

from boa3.builtin import public

from boa3.builtin.interop.storage import get, put


COUNTER_KEY = "counter"


@public
def store(key: str, value: str) -> bool:
    if not key:
        return False
    put(key, value)
    return True


@public
def retrieve(key: str) -> Optional[str]:
    result = get(key)
    if result is None:
        return None
    return result.to_str()


@public
def increment() -> int:
    value = get(COUNTER_KEY)
    current = 0 if value is None else value.to_int()
    new = current + 1
    put(COUNTER_KEY, new)
    return new


@public
def counter() -> int:
    value = get(COUNTER_KEY)
    return 0 if value is None else value.to_int()
