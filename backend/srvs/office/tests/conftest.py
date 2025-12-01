import sys
from pathlib import Path

import pytest
from rest_framework.test import APIClient


# اطمینان از آن‌که ریشه پروژه در PYTHONPATH باشد
ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


@pytest.fixture
def api_client():
    return APIClient()
