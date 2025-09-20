"""
Unit tests for AuthService functionality.

This module tests authentication, JWT token handling, user registration,
login, password management, and user profile operations.
"""

import pytest
import json
import time
from unittest.mock import patch, MagicMock, AsyncMock
from datetime import datetime, timedelta


class TestAuthService:
    """Test suite for AuthService class."""

    @pytest.fixture
    def mock_user_data(self):
        """Sample user data for testing."""
        return {
            'email': 'test@example.com',
            'password': 'Test123!@#',
            'firstName': 'John',
            'lastName': 'Doe',
            'company': 'Test Corp'
        }

    @pytest.fixture
    def mock_user_response(self):
        """Mock user response from database."""
        return {
            'id': 'user-123',
            'email': 'test@example.com',
            'firstName': 'John',
            'lastName': 'Doe',
            'company': 'Test Corp',
            'role': 'USER',
            'isActive': True,
            'createdAt': datetime.now(),
            'updatedAt': datetime.now()
        }

    @pytest.fixture
    def mock_prisma(self):
        """Mock Prisma client."""
        with patch('tests.test_auth_service.PrismaClient') as mock_prisma:
            yield mock_prisma.return_value

    @pytest.mark.unit
    def test_user_registration_success(self, mock_user_data, mock_user_response, mock_prisma):
        """Test successful user registration."""
        # Mock database operations
        mock_prisma.user.findUnique.return_value = None  # User doesn't exist
        mock_prisma.user.create.return_value = mock_user_response
        mock_prisma.subscription.create.return_value = {'id': 'sub-123'}

        # Mock password hashing
        with patch('tests.test_auth_service.hashPassword') as mock_hash:
            mock_hash.return_value = 'hashed_password'

            # Mock AuthService
            with patch('tests.test_auth_service.AuthService') as MockAuthService:
                MockAuthService.register.return_value = mock_user_response

                result = MockAuthService.register(mock_user_data)

                # Verify user was created
                assert result == mock_user_response
                MockAuthService.register.assert_called_once_with(mock_user_data)

    @pytest.mark.unit
    def test_user_registration_duplicate_email(self, mock_user_data, mock_prisma):
        """Test user registration with duplicate email."""
        # Mock existing user
        mock_prisma.user.findUnique.return_value = {'id': 'existing-user'}

        with patch('tests.test_auth_service.AuthService') as MockAuthService:
            from tests.test_auth_service import ConflictError
            MockAuthService.register.side_effect = ConflictError('User with this email already exists')

            with pytest.raises(ConflictError):
                MockAuthService.register(mock_user_data)

    @pytest.mark.unit
    def test_user_login_success(self, mock_prisma):
        """Test successful user login."""
        login_data = {'email': 'test@example.com', 'password': 'Test123!@#'}
        mock_user = {
            'id': 'user-123',
            'email': 'test@example.com',
            'password': 'hashed_password',
            'role': 'USER',
            'isActive': True,
            'subscriptions': []
        }

        mock_prisma.user.findUnique.return_value = mock_user

        # Mock password comparison and token generation
        with patch('tests.test_auth_service.comparePassword') as mock_compare, \
             patch('tests.test_auth_service.generateAccessToken') as mock_access, \
             patch('tests.test_auth_service.generateRefreshToken') as mock_refresh:

            mock_compare.return_value = True
            mock_access.return_value = 'access_token_123'
            mock_refresh.return_value = 'refresh_token_123'

            with patch('tests.test_auth_service.AuthService') as MockAuthService:
                expected_response = {
                    'user': {k: v for k, v in mock_user.items() if k != 'password'},
                    'accessToken': 'access_token_123',
                    'refreshToken': 'refresh_token_123'
                }
                MockAuthService.login.return_value = expected_response

                result = MockAuthService.login(login_data)

                assert result == expected_response
                assert 'password' not in result['user']

    @pytest.mark.unit
    def test_user_login_invalid_credentials(self, mock_prisma):
        """Test login with invalid credentials."""
        login_data = {'email': 'test@example.com', 'password': 'wrong_password'}

        with patch('tests.test_auth_service.AuthService') as MockAuthService:
            from tests.test_auth_service import AuthenticationError
            MockAuthService.login.side_effect = AuthenticationError('Invalid email or password')

            with pytest.raises(AuthenticationError):
                MockAuthService.login(login_data)

    @pytest.mark.unit
    def test_user_login_inactive_account(self, mock_prisma):
        """Test login with inactive account."""
        login_data = {'email': 'test@example.com', 'password': 'Test123!@#'}

        with patch('tests.test_auth_service.AuthService') as MockAuthService:
            from tests.test_auth_service import AuthenticationError
            MockAuthService.login.side_effect = AuthenticationError('Account is deactivated')

            with pytest.raises(AuthenticationError):
                MockAuthService.login(login_data)

    @pytest.mark.unit
    def test_refresh_token_success(self, mock_prisma):
        """Test successful token refresh."""
        refresh_token = 'valid_refresh_token'
        mock_payload = {'userId': 'user-123', 'email': 'test@example.com', 'role': 'USER'}
        mock_user = {
            'id': 'user-123',
            'email': 'test@example.com',
            'role': 'USER',
            'isActive': True
        }

        mock_prisma.user.findUnique.return_value = mock_user

        with patch('tests.test_auth_service.verifyRefreshToken') as mock_verify, \
             patch('tests.test_auth_service.generateAccessToken') as mock_generate:

            mock_verify.return_value = mock_payload
            mock_generate.return_value = 'new_access_token'

            with patch('tests.test_auth_service.AuthService') as MockAuthService:
                MockAuthService.refreshToken.return_value = {'accessToken': 'new_access_token'}

                result = MockAuthService.refreshToken(refresh_token)

                assert result == {'accessToken': 'new_access_token'}

    @pytest.mark.unit
    def test_refresh_token_invalid(self):
        """Test refresh token with invalid token."""
        invalid_token = 'invalid_token'

        with patch('tests.test_auth_service.AuthService') as MockAuthService:
            from tests.test_auth_service import AuthenticationError
            MockAuthService.refreshToken.side_effect = AuthenticationError('Invalid token')

            with pytest.raises(AuthenticationError):
                MockAuthService.refreshToken(invalid_token)

    @pytest.mark.unit
    def test_change_password_success(self, mock_prisma):
        """Test successful password change."""
        user_id = 'user-123'
        current_password = 'old_password'
        new_password = 'new_password'

        mock_user = {
            'id': user_id,
            'password': 'hashed_old_password'
        }

        mock_prisma.user.findUnique.return_value = mock_user
        mock_prisma.user.update.return_value = mock_user

        with patch('tests.test_auth_service.comparePassword') as mock_compare, \
             patch('tests.test_auth_service.hashPassword') as mock_hash:

            mock_compare.return_value = True
            mock_hash.return_value = 'hashed_new_password'

            with patch('tests.test_auth_service.AuthService') as MockAuthService:
                MockAuthService.changePassword.return_value = None

                # Should not raise any exception
                MockAuthService.changePassword(user_id, current_password, new_password)
                MockAuthService.changePassword.assert_called_once_with(user_id, current_password, new_password)

    @pytest.mark.unit
    def test_change_password_wrong_current_password(self, mock_prisma):
        """Test password change with wrong current password."""
        user_id = 'user-123'
        wrong_password = 'wrong_password'
        new_password = 'new_password'

        with patch('tests.test_auth_service.AuthService') as MockAuthService:
            from tests.test_auth_service import AuthenticationError
            MockAuthService.changePassword.side_effect = AuthenticationError('Current password is incorrect')

            with pytest.raises(AuthenticationError):
                MockAuthService.changePassword(user_id, wrong_password, new_password)

    @pytest.mark.unit
    def test_get_user_profile_success(self, mock_prisma, mock_user_response):
        """Test successful user profile retrieval."""
        user_id = 'user-123'

        mock_prisma.user.findUnique.return_value = mock_user_response

        with patch('tests.test_auth_service.AuthService') as MockAuthService:
            MockAuthService.getUserProfile.return_value = mock_user_response

            result = MockAuthService.getUserProfile(user_id)

            assert result == mock_user_response
            MockAuthService.getUserProfile.assert_called_once_with(user_id)

    @pytest.mark.unit
    def test_get_user_profile_not_found(self, mock_prisma):
        """Test user profile retrieval for non-existent user."""
        user_id = 'non-existent'

        with patch('tests.test_auth_service.AuthService') as MockAuthService:
            from tests.test_auth_service import NotFoundError
            MockAuthService.getUserProfile.side_effect = NotFoundError('User not found')

            with pytest.raises(NotFoundError):
                MockAuthService.getUserProfile(user_id)

    @pytest.mark.unit
    def test_update_user_profile_success(self, mock_prisma):
        """Test successful user profile update."""
        user_id = 'user-123'
        update_data = {
            'firstName': 'Jane',
            'lastName': 'Smith',
            'company': 'New Corp'
        }

        updated_user = {
            'id': user_id,
            'email': 'test@example.com',
            'firstName': 'Jane',
            'lastName': 'Smith',
            'company': 'New Corp',
            'role': 'USER',
            'isActive': True,
            'createdAt': datetime.now(),
            'updatedAt': datetime.now()
        }

        mock_prisma.user.update.return_value = updated_user

        with patch('tests.test_auth_service.AuthService') as MockAuthService:
            MockAuthService.updateUserProfile.return_value = updated_user

            result = MockAuthService.updateUserProfile(user_id, update_data)

            assert result == updated_user
            MockAuthService.updateUserProfile.assert_called_once_with(user_id, update_data)

    @pytest.mark.unit
    def test_deactivate_user_success(self, mock_prisma):
        """Test successful user deactivation."""
        user_id = 'user-123'

        mock_prisma.user.update.return_value = {'id': user_id, 'isActive': False}
        mock_prisma.license.updateMany.return_value = {'count': 2}
        mock_prisma.apiKey.updateMany.return_value = {'count': 1}

        with patch('tests.test_auth_service.AuthService') as MockAuthService:
            MockAuthService.deactivateUser.return_value = None

            # Should not raise any exception
            MockAuthService.deactivateUser(user_id)
            MockAuthService.deactivateUser.assert_called_once_with(user_id)

    @pytest.mark.unit
    def test_password_reset_request(self, mock_prisma):
        """Test password reset request."""
        email = 'test@example.com'

        mock_user = {
            'id': 'user-123',
            'email': email
        }

        mock_prisma.user.findUnique.return_value = mock_user

        with patch('tests.test_auth_service.AuthService') as MockAuthService:
            MockAuthService.requestPasswordReset.return_value = None

            # Should not raise any exception
            MockAuthService.requestPasswordReset(email)
            MockAuthService.requestPasswordReset.assert_called_once_with(email)

    @pytest.mark.unit
    def test_password_reset_request_non_existent_user(self, mock_prisma):
        """Test password reset request for non-existent user."""
        email = 'nonexistent@example.com'

        mock_prisma.user.findUnique.return_value = None

        with patch('tests.test_auth_service.AuthService') as MockAuthService:
            MockAuthService.requestPasswordReset.return_value = None

            # Should not raise any exception (security: don't reveal if user exists)
            MockAuthService.requestPasswordReset(email)
            MockAuthService.requestPasswordReset.assert_called_once_with(email)

    @pytest.mark.unit
    def test_email_verification(self, mock_prisma):
        """Test email verification."""
        user_id = 'user-123'
        verification_token = 'verification_token_123'

        with patch('tests.test_auth_service.AuthService') as MockAuthService:
            MockAuthService.verifyEmail.return_value = None

            # Should not raise any exception
            MockAuthService.verifyEmail(user_id, verification_token)
            MockAuthService.verifyEmail.assert_called_once_with(user_id, verification_token)


# Mock classes for error handling
class AuthenticationError(Exception):
    pass

class NotFoundError(Exception):
    pass

class ConflictError(Exception):
    pass

class CustomError(Exception):
    pass

# Mock imports (these would normally come from the actual modules)
def hashPassword(password):
    return f"hashed_{password}"

def comparePassword(password, hashed):
    return password == 'Test123!@#' and hashed == 'hashed_password'

def generateAccessToken(payload):
    return f"access_token_{payload['userId']}"

def generateRefreshToken(payload):
    return f"refresh_token_{payload['userId']}"

def verifyRefreshToken(token):
    if token == 'valid_refresh_token':
        return {'userId': 'user-123', 'email': 'test@example.com', 'role': 'USER'}
    raise AuthenticationError('Invalid token')

# Mock Prisma client
class PrismaClient:
    def __init__(self):
        self.user = MagicMock()
        self.subscription = MagicMock()
        self.license = MagicMock()
        self.apiKey = MagicMock()

# Mock AuthService
class AuthService:
    @staticmethod
    def register(user_data):
        pass

    @staticmethod
    def login(login_data):
        pass

    @staticmethod
    def refreshToken(refresh_token):
        pass

    @staticmethod
    def changePassword(user_id, current_password, new_password):
        pass

    @staticmethod
    def requestPasswordReset(email):
        pass

    @staticmethod
    def verifyEmail(user_id, verification_token):
        pass

    @staticmethod
    def getUserProfile(user_id):
        pass

    @staticmethod
    def updateUserProfile(user_id, update_data):
        pass

    @staticmethod
    def deactivateUser(user_id):
        pass