"""Python mirror of the TS engine in /engine.

Same formulas, same constants, same RNG. Golden tests in backend/tests/
verify bit-exact PRNG parity and within-tolerance sim parity against the
TS engine. Used by the FastAPI router to replay a finished run server-side
and validate the client's claimed result before writing to the leaderboard.
"""

SIM_VERSION = 1
