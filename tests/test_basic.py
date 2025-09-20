"""
Basic test to verify pytest configuration and timeout handling.
"""

import time
import pytest


class TestBasic:
    """Basic tests to verify the test infrastructure."""

    def test_simple_pass(self):
        """Simple test that should pass quickly."""
        assert True

    def test_simple_math(self):
        """Simple math test."""
        assert 2 + 2 == 4

    @pytest.mark.slow
    def test_with_small_delay(self):
        """Test with small delay to verify timeouts work."""
        time.sleep(0.1)  # 100ms delay
        assert True

    def test_mock_import(self):
        """Test that we can mock imports."""
        from unittest.mock import patch, MagicMock

        with patch('subprocess.run') as mock_run:
            mock_run.return_value = MagicMock(returncode=0)
            import subprocess
            result = subprocess.run(['echo', 'test'])
            assert result.returncode == 0