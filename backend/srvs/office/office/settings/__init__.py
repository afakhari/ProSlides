"""
Default settings entrypoint.

Imports development settings by default; for production set
DJANGO_SETTINGS_MODULE=backend.srvs.office.office.settings.prod
or import the desired module directly.
"""

from .dev import *  # noqa: F401,F403
