"""Mulberry32 + splitMix32 PRNG. Must match engine/prng.ts BIT-FOR-BIT on
nextU32() outputs. JavaScript's Math.imul takes the low 32 bits of a signed
product; we keep state in uint32 throughout and mask after every operation
so the unsigned right-shift (`>>>`) and `| 1` semantics match Python's
non-negative right-shift on the same uint32 representation."""

from __future__ import annotations

MASK32 = 0xFFFFFFFF


def to_uint32(x: int) -> int:
    return x & MASK32


def imul32(a: int, b: int) -> int:
    """JS Math.imul, returned as uint32."""
    return (a * b) & MASK32


def mix32(z: int) -> int:
    """Avalanche mixer used for seeding & splitting child streams. Matches
    engine/prng.ts mix32 exactly."""
    z = to_uint32(z)
    z = (z + 0x9E3779B9) & MASK32
    z = ((z ^ (z >> 16)) * 0x21F0AAAD) & MASK32
    z = ((z ^ (z >> 15)) * 0x735A2D97) & MASK32
    return (z ^ (z >> 15)) & MASK32


def seed_from_string(s: str) -> int:
    """FNV-1a-style hash, mixed. Matches seedFromString in TS."""
    h = 0x811C9DC5
    for ch in s:
        h ^= ord(ch) & 0xFF
        h = imul32(h, 0x01000193)
    return mix32(h)


class PRNG:
    __slots__ = ("state",)

    def __init__(self, state: int) -> None:
        self.state = to_uint32(state)

    @classmethod
    def from_seed(cls, seed: int | str) -> "PRNG":
        if isinstance(seed, str):
            return cls(seed_from_string(seed))
        return cls(mix32(to_uint32(seed)))

    def next_u32(self) -> int:
        """One Mulberry32 step. Bit-exact with engine/prng.ts nextU32."""
        self.state = (self.state + 0x6D2B79F5) & MASK32
        t = self.state
        t = ((t ^ (t >> 15)) * (t | 1)) & MASK32
        inner = ((t ^ (t >> 7)) * (t | 61)) & MASK32
        t = (t ^ ((t + inner) & MASK32)) & MASK32
        return (t ^ (t >> 14)) & MASK32

    def next_float(self) -> float:
        """[0, 1) double. nextU32() / 2^32 — same expression as TS."""
        return self.next_u32() / 0x100000000

    def next_int(self, lo: int, hi_exclusive: int) -> int:
        if hi_exclusive <= lo:
            return lo
        return lo + (self.next_u32() % (hi_exclusive - lo))

    def next_normal(self, mean: float = 0.0, std: float = 1.0) -> float:
        """Box-Muller — agrees to ~12 decimal places with TS due to platform
        differences in math library implementations of log/cos/sqrt. Sim
        outcomes (W/D/L) compared in golden tests can rely on the
        `r < threshold` step being insensitive to ULP-level differences."""
        from math import cos, log, pi, sqrt
        u1 = self.next_float()
        if u1 < 1e-12:
            u1 = 1e-12
        u2 = self.next_float()
        z = sqrt(-2.0 * log(u1)) * cos(2.0 * pi * u2)
        return mean + std * z

    def split(self, salt: int = 0) -> "PRNG":
        salt_u32 = to_uint32(salt)
        child_seed = mix32((self.state ^ imul32(salt_u32, 0x85EBCA6B)) & MASK32)
        return PRNG(child_seed)

    def clone(self) -> "PRNG":
        return PRNG(self.state)


def weighted_pick(prng: PRNG, items: list, weights: list[float]):
    if not items:
        raise ValueError("weighted_pick: empty items")
    total = sum(max(0.0, w) for w in weights)
    if total <= 0:
        return items[prng.next_int(0, len(items))]
    r = prng.next_float() * total
    for it, w in zip(items, weights):
        r -= max(0.0, w)
        if r <= 0:
            return it
    return items[-1]
