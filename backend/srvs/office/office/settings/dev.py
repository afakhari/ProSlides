from .base import *  # noqa: F401,F403

# Development overrides
DEBUG = True
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["*"])

# Keep permissive CORS in dev
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
