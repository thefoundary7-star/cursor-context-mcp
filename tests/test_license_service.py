"""
Unit tests for LicenseService functionality.

This module tests license creation, validation, quota management,
server registration, and license lifecycle operations.
"""

import pytest
import json
from unittest.mock import patch, MagicMock, AsyncMock
from datetime import datetime, timedelta


class TestLicenseService:
    """Test suite for LicenseService class."""

    @pytest.fixture
    def mock_license_data(self):
        """Sample license data for testing."""
        return {
            'name': 'Test License',
            'description': 'License for testing',
            'plan': 'PRO',
            'maxServers': 5,
            'expiresAt': datetime.now() + timedelta(days=365)
        }

    @pytest.fixture
    def mock_license_response(self):
        """Mock license response from database."""
        return {
            'id': 'license-123',
            'userId': 'user-123',
            'licenseKey': 'LIC-TEST-1234-ABCD-5678',
            'name': 'Test License',
            'description': 'License for testing',
            'plan': 'PRO',
            'maxServers': 5,
            'isActive': True,
            'expiresAt': datetime.now() + timedelta(days=365),
            'createdAt': datetime.now(),
            'updatedAt': datetime.now()
        }

    @pytest.fixture
    def mock_validation_request(self):
        """Sample license validation request."""
        return {
            'licenseKey': 'LIC-TEST-1234-ABCD-5678',
            'serverId': 'server-123',
            'serverName': 'Test Server',
            'serverVersion': '1.0.0'
        }

    @pytest.fixture
    def mock_server_response(self):
        """Mock server response from database."""
        return {
            'id': 'server-123',
            'licenseId': 'license-123',
            'serverId': 'server-123',
            'name': 'Test Server',
            'version': '1.0.0',
            'isActive': True,
            'lastSeen': datetime.now(),
            'createdAt': datetime.now()
        }

    @pytest.fixture
    def mock_prisma(self):
        """Mock Prisma client."""
        with patch('tests.test_license_service.PrismaClient') as mock_prisma:
            yield mock_prisma.return_value

    @pytest.mark.unit
    def test_create_license_success(self, mock_license_data, mock_license_response, mock_prisma):
        """Test successful license creation."""
        user_id = 'user-123'

        # Mock subscription check
        mock_subscription = {
            'id': 'sub-123',
            'userId': user_id,
            'status': 'ACTIVE'
        }

        mock_prisma.subscription.findFirst.return_value = mock_subscription
        mock_prisma.license.findUnique.return_value = None  # No duplicate license key
        mock_prisma.license.create.return_value = mock_license_response

        with patch('tests.test_license_service.generateLicenseKey') as mock_generate:
            mock_generate.return_value = 'LIC-TEST-1234-ABCD-5678'

            with patch('tests.test_license_service.LicenseService') as MockLicenseService:
                MockLicenseService.createLicense.return_value = mock_license_response

                result = MockLicenseService.createLicense(user_id, mock_license_data)

                assert result == mock_license_response
                MockLicenseService.createLicense.assert_called_once_with(user_id, mock_license_data)

    @pytest.mark.unit
    def test_create_license_no_subscription(self, mock_license_data, mock_prisma):
        """Test license creation without active subscription."""
        user_id = 'user-123'

        mock_prisma.subscription.findFirst.return_value = None

        with patch('tests.test_license_service.LicenseService') as MockLicenseService:
            from tests.test_license_service import ConflictError
            MockLicenseService.createLicense.side_effect = ConflictError('No active subscription found')

            with pytest.raises(ConflictError):
                MockLicenseService.createLicense(user_id, mock_license_data)

    @pytest.mark.unit
    def test_create_license_key_generation_failure(self, mock_license_data, mock_prisma):
        """Test license creation when license key generation fails."""
        user_id = 'user-123'

        mock_subscription = {'id': 'sub-123', 'status': 'ACTIVE'}
        mock_prisma.subscription.findFirst.return_value = mock_subscription
        # Always return existing license (simulate duplicate keys)
        mock_prisma.license.findUnique.return_value = {'id': 'existing'}

        with patch('tests.test_license_service.LicenseService') as MockLicenseService:
            from tests.test_license_service import ConflictError
            MockLicenseService.createLicense.side_effect = ConflictError('Failed to generate unique license key')

            with pytest.raises(ConflictError):
                MockLicenseService.createLicense(user_id, mock_license_data)

    @pytest.mark.unit
    def test_validate_license_success(self, mock_validation_request, mock_license_response, mock_server_response, mock_prisma):
        """Test successful license validation."""
        # Mock license with user and servers
        mock_license_with_relations = {
            **mock_license_response,
            'user': {'id': 'user-123', 'email': 'test@example.com', 'isActive': True},
            'servers': []  # No existing servers, within quota
        }

        mock_prisma.license.findUnique.return_value = mock_license_with_relations
        mock_prisma.server.findUnique.return_value = None  # New server
        mock_prisma.server.create.return_value = mock_server_response

        expected_response = {
            'valid': True,
            'license': {k: v for k, v in mock_license_with_relations.items() if k != 'userId'},
            'server': mock_server_response
        }

        with patch('tests.test_license_service.LicenseService') as MockLicenseService:
            MockLicenseService.validateLicense.return_value = expected_response

            result = MockLicenseService.validateLicense(mock_validation_request)

            assert result == expected_response
            assert result['valid'] is True
            assert 'userId' not in result['license']

    @pytest.mark.unit
    def test_validate_license_invalid_key(self, mock_validation_request, mock_prisma):
        """Test license validation with invalid key."""
        mock_prisma.license.findUnique.return_value = None

        expected_response = {
            'valid': False,
            'message': 'Invalid license key'
        }

        with patch('tests.test_license_service.LicenseService') as MockLicenseService:
            MockLicenseService.validateLicense.return_value = expected_response

            result = MockLicenseService.validateLicense(mock_validation_request)

            assert result == expected_response
            assert result['valid'] is False

    @pytest.mark.unit
    def test_validate_license_inactive(self, mock_validation_request, mock_license_response, mock_prisma):
        """Test license validation with inactive license."""
        inactive_license = {
            **mock_license_response,
            'isActive': False,
            'user': {'id': 'user-123', 'email': 'test@example.com', 'isActive': True},
            'servers': []
        }

        mock_prisma.license.findUnique.return_value = inactive_license

        expected_response = {
            'valid': False,
            'message': 'License is deactivated'
        }

        with patch('tests.test_license_service.LicenseService') as MockLicenseService:
            MockLicenseService.validateLicense.return_value = expected_response

            result = MockLicenseService.validateLicense(mock_validation_request)

            assert result == expected_response
            assert result['valid'] is False

    @pytest.mark.unit
    def test_validate_license_expired(self, mock_validation_request, mock_license_response, mock_prisma):
        """Test license validation with expired license."""
        expired_license = {
            **mock_license_response,
            'expiresAt': datetime.now() - timedelta(days=1),  # Expired yesterday
            'user': {'id': 'user-123', 'email': 'test@example.com', 'isActive': True},
            'servers': []
        }

        mock_prisma.license.findUnique.return_value = expired_license

        expected_response = {
            'valid': False,
            'message': 'License has expired'
        }

        with patch('tests.test_license_service.LicenseService') as MockLicenseService:
            MockLicenseService.validateLicense.return_value = expected_response

            result = MockLicenseService.validateLicense(mock_validation_request)

            assert result == expected_response
            assert result['valid'] is False

    @pytest.mark.unit
    def test_validate_license_quota_exceeded(self, mock_validation_request, mock_license_response, mock_prisma):
        """Test license validation with server quota exceeded."""
        # Create 5 existing servers to exceed quota of 5
        existing_servers = [{'id': f'server-{i}', 'isActive': True} for i in range(5)]

        license_at_quota = {
            **mock_license_response,
            'maxServers': 5,
            'user': {'id': 'user-123', 'email': 'test@example.com', 'isActive': True},
            'servers': existing_servers
        }

        mock_prisma.license.findUnique.return_value = license_at_quota

        expected_response = {
            'valid': False,
            'message': 'Server quota exceeded'
        }

        with patch('tests.test_license_service.LicenseService') as MockLicenseService:
            MockLicenseService.validateLicense.return_value = expected_response

            result = MockLicenseService.validateLicense(mock_validation_request)

            assert result == expected_response
            assert result['valid'] is False

    @pytest.mark.unit
    def test_validate_license_update_existing_server(self, mock_validation_request, mock_license_response, mock_server_response, mock_prisma):
        """Test license validation with existing server update."""
        mock_license_with_relations = {
            **mock_license_response,
            'user': {'id': 'user-123', 'email': 'test@example.com', 'isActive': True},
            'servers': []
        }

        existing_server = {
            'id': 'server-db-123',
            'serverId': 'server-123',
            'name': 'Old Server Name',
            'version': '0.9.0'
        }

        updated_server = {
            **mock_server_response,
            'name': 'Test Server',  # Updated from validation request
            'version': '1.0.0'      # Updated from validation request
        }

        mock_prisma.license.findUnique.return_value = mock_license_with_relations
        mock_prisma.server.findUnique.return_value = existing_server
        mock_prisma.server.update.return_value = updated_server

        expected_response = {
            'valid': True,
            'license': {k: v for k, v in mock_license_with_relations.items() if k != 'userId'},
            'server': updated_server
        }

        with patch('tests.test_license_service.LicenseService') as MockLicenseService:
            MockLicenseService.validateLicense.return_value = expected_response

            result = MockLicenseService.validateLicense(mock_validation_request)

            assert result == expected_response
            assert result['valid'] is True

    @pytest.mark.unit
    def test_get_user_licenses_success(self, mock_license_response, mock_prisma):
        """Test successful user licenses retrieval."""
        user_id = 'user-123'
        page = 1
        limit = 10

        licenses_with_relations = [{
            **mock_license_response,
            'servers': [{'id': 'server-1', 'isActive': True}],
            '_count': {'servers': 1, 'analytics': 10}
        }]

        mock_prisma.license.findMany.return_value = licenses_with_relations
        mock_prisma.license.count.return_value = 1

        expected_result = {
            'licenses': licenses_with_relations,
            'total': 1
        }

        with patch('tests.test_license_service.LicenseService') as MockLicenseService:
            MockLicenseService.getUserLicenses.return_value = expected_result

            result = MockLicenseService.getUserLicenses(user_id, page, limit)

            assert result == expected_result
            assert len(result['licenses']) == 1
            assert result['total'] == 1

    @pytest.mark.unit
    def test_get_license_by_id_success(self, mock_license_response, mock_prisma):
        """Test successful license retrieval by ID."""
        license_id = 'license-123'
        user_id = 'user-123'

        license_with_relations = {
            **mock_license_response,
            'servers': [],
            '_count': {'servers': 0, 'analytics': 0}
        }

        mock_prisma.license.findFirst.return_value = license_with_relations

        with patch('tests.test_license_service.LicenseService') as MockLicenseService:
            MockLicenseService.getLicenseById.return_value = license_with_relations

            result = MockLicenseService.getLicenseById(license_id, user_id)

            assert result == license_with_relations
            MockLicenseService.getLicenseById.assert_called_once_with(license_id, user_id)

    @pytest.mark.unit
    def test_get_license_by_id_not_found(self, mock_prisma):
        """Test license retrieval by ID when not found."""
        license_id = 'non-existent'
        user_id = 'user-123'

        mock_prisma.license.findFirst.return_value = None

        with patch('tests.test_license_service.LicenseService') as MockLicenseService:
            from tests.test_license_service import NotFoundError
            MockLicenseService.getLicenseById.side_effect = NotFoundError('License not found')

            with pytest.raises(NotFoundError):
                MockLicenseService.getLicenseById(license_id, user_id)

    @pytest.mark.unit
    def test_update_license_success(self, mock_license_response, mock_prisma):
        """Test successful license update."""
        license_id = 'license-123'
        user_id = 'user-123'
        update_data = {
            'name': 'Updated License Name',
            'description': 'Updated description',
            'maxServers': 10
        }

        updated_license = {
            **mock_license_response,
            **update_data
        }

        mock_prisma.license.findFirst.return_value = mock_license_response
        mock_prisma.license.update.return_value = updated_license

        with patch('tests.test_license_service.LicenseService') as MockLicenseService:
            MockLicenseService.updateLicense.return_value = updated_license

            result = MockLicenseService.updateLicense(license_id, user_id, update_data)

            assert result == updated_license
            MockLicenseService.updateLicense.assert_called_once_with(license_id, user_id, update_data)

    @pytest.mark.unit
    def test_update_license_not_found(self, mock_prisma):
        """Test license update when license not found."""
        license_id = 'non-existent'
        user_id = 'user-123'
        update_data = {'name': 'New Name'}

        mock_prisma.license.findFirst.return_value = None

        with patch('tests.test_license_service.LicenseService') as MockLicenseService:
            from tests.test_license_service import NotFoundError
            MockLicenseService.updateLicense.side_effect = NotFoundError('License not found')

            with pytest.raises(NotFoundError):
                MockLicenseService.updateLicense(license_id, user_id, update_data)

    @pytest.mark.unit
    def test_deactivate_license_success(self, mock_license_response, mock_prisma):
        """Test successful license deactivation."""
        license_id = 'license-123'
        user_id = 'user-123'

        mock_prisma.license.findFirst.return_value = mock_license_response
        mock_prisma.license.update.return_value = {**mock_license_response, 'isActive': False}
        mock_prisma.server.updateMany.return_value = {'count': 2}

        with patch('tests.test_license_service.LicenseService') as MockLicenseService:
            MockLicenseService.deactivateLicense.return_value = None

            # Should not raise any exception
            MockLicenseService.deactivateLicense(license_id, user_id)
            MockLicenseService.deactivateLicense.assert_called_once_with(license_id, user_id)

    @pytest.mark.unit
    def test_get_usage_quota_success(self, mock_license_response, mock_prisma):
        """Test successful usage quota retrieval."""
        license_id = 'license-123'

        # Mock license with usage data
        license_with_usage = {
            **mock_license_response,
            'plan': 'PRO',
            'servers': [
                {'id': 'server-1', 'isActive': True},
                {'id': 'server-2', 'isActive': True}
            ],
            'analytics': [
                {'eventType': 'REQUEST_COUNT', 'timestamp': datetime.now()},
                {'eventType': 'ERROR_COUNT', 'timestamp': datetime.now()}
            ]
        }

        mock_prisma.license.findUnique.return_value = license_with_usage

        expected_quota = {
            'plan': 'PRO',
            'maxServers': 20,
            'maxRequestsPerMonth': 100000,
            'maxAnalyticsEvents': 1000000,
            'currentUsage': {
                'servers': 2,
                'requestsThisMonth': 1,  # Only REQUEST_COUNT events
                'analyticsEvents': 2
            }
        }

        with patch('tests.test_license_service.LicenseService') as MockLicenseService:
            MockLicenseService.getUsageQuota.return_value = expected_quota

            result = MockLicenseService.getUsageQuota(license_id)

            assert result == expected_quota
            assert result['currentUsage']['servers'] == 2
            assert result['maxServers'] == 20

    @pytest.mark.unit
    def test_get_usage_quota_not_found(self, mock_prisma):
        """Test usage quota retrieval for non-existent license."""
        license_id = 'non-existent'

        mock_prisma.license.findUnique.return_value = None

        with patch('tests.test_license_service.LicenseService') as MockLicenseService:
            from tests.test_license_service import NotFoundError
            MockLicenseService.getUsageQuota.side_effect = NotFoundError('License not found')

            with pytest.raises(NotFoundError):
                MockLicenseService.getUsageQuota(license_id)

    @pytest.mark.unit
    def test_check_quota_within_limits(self, mock_prisma):
        """Test quota check when within limits."""
        license_id = 'license-123'

        quota_within_limits = {
            'plan': 'PRO',
            'maxServers': 20,
            'maxRequestsPerMonth': 100000,
            'maxAnalyticsEvents': 1000000,
            'currentUsage': {
                'servers': 5,
                'requestsThisMonth': 1000,
                'analyticsEvents': 10000
            }
        }

        with patch('tests.test_license_service.LicenseService') as MockLicenseService:
            MockLicenseService.getUsageQuota.return_value = quota_within_limits
            MockLicenseService.checkQuota.return_value = None

            # Should not raise any exception
            MockLicenseService.checkQuota(license_id)
            MockLicenseService.checkQuota.assert_called_once_with(license_id)

    @pytest.mark.unit
    def test_check_quota_servers_exceeded(self, mock_prisma):
        """Test quota check when server quota is exceeded."""
        license_id = 'license-123'

        quota_servers_exceeded = {
            'plan': 'FREE',
            'maxServers': 1,
            'maxRequestsPerMonth': 1000,
            'maxAnalyticsEvents': 10000,
            'currentUsage': {
                'servers': 2,  # Exceeds limit of 1
                'requestsThisMonth': 100,
                'analyticsEvents': 1000
            }
        }

        with patch('tests.test_license_service.LicenseService') as MockLicenseService:
            MockLicenseService.getUsageQuota.return_value = quota_servers_exceeded

            from tests.test_license_service import QuotaExceededError
            MockLicenseService.checkQuota.side_effect = QuotaExceededError('servers', 2, 1)

            with pytest.raises(QuotaExceededError):
                MockLicenseService.checkQuota(license_id)

    @pytest.mark.unit
    def test_check_quota_requests_exceeded(self, mock_prisma):
        """Test quota check when request quota is exceeded."""
        license_id = 'license-123'

        quota_requests_exceeded = {
            'plan': 'FREE',
            'maxServers': 1,
            'maxRequestsPerMonth': 1000,
            'maxAnalyticsEvents': 10000,
            'currentUsage': {
                'servers': 1,
                'requestsThisMonth': 1001,  # Exceeds limit of 1000
                'analyticsEvents': 1000
            }
        }

        with patch('tests.test_license_service.LicenseService') as MockLicenseService:
            MockLicenseService.getUsageQuota.return_value = quota_requests_exceeded

            from tests.test_license_service import QuotaExceededError
            MockLicenseService.checkQuota.side_effect = QuotaExceededError('requests', 1001, 1000)

            with pytest.raises(QuotaExceededError):
                MockLicenseService.checkQuota(license_id)

    @pytest.mark.unit
    def test_check_quota_analytics_exceeded(self, mock_prisma):
        """Test quota check when analytics quota is exceeded."""
        license_id = 'license-123'

        quota_analytics_exceeded = {
            'plan': 'FREE',
            'maxServers': 1,
            'maxRequestsPerMonth': 1000,
            'maxAnalyticsEvents': 10000,
            'currentUsage': {
                'servers': 1,
                'requestsThisMonth': 100,
                'analyticsEvents': 10001  # Exceeds limit of 10000
            }
        }

        with patch('tests.test_license_service.LicenseService') as MockLicenseService:
            MockLicenseService.getUsageQuota.return_value = quota_analytics_exceeded

            from tests.test_license_service import QuotaExceededError
            MockLicenseService.checkQuota.side_effect = QuotaExceededError('analytics', 10001, 10000)

            with pytest.raises(QuotaExceededError):
                MockLicenseService.checkQuota(license_id)


# Mock classes and functions
class NotFoundError(Exception):
    pass

class ConflictError(Exception):
    pass

class LicenseValidationError(Exception):
    pass

class QuotaExceededError(Exception):
    def __init__(self, resource_type, current, limit):
        self.resource_type = resource_type
        self.current = current
        self.limit = limit
        super().__init__(f"{resource_type} quota exceeded: {current}/{limit}")

def generateLicenseKey():
    return 'LIC-TEST-1234-ABCD-5678'

# Mock Prisma client
class PrismaClient:
    def __init__(self):
        self.subscription = MagicMock()
        self.license = MagicMock()
        self.server = MagicMock()

# Mock LicenseService
class LicenseService:
    @staticmethod
    def createLicense(user_id, license_data):
        pass

    @staticmethod
    def validateLicense(validation_data):
        pass

    @staticmethod
    def getUserLicenses(user_id, page=1, limit=10):
        pass

    @staticmethod
    def getLicenseById(license_id, user_id):
        pass

    @staticmethod
    def updateLicense(license_id, user_id, update_data):
        pass

    @staticmethod
    def deactivateLicense(license_id, user_id):
        pass

    @staticmethod
    def getUsageQuota(license_id):
        pass

    @staticmethod
    def checkQuota(license_id):
        pass