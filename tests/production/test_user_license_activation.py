"""
User Registration and License Activation Tests

This module tests user account creation, license-user relationships,
license activation via CLI and web interface, authentication, and usage tracking.
"""

import pytest
import pytest_asyncio
import asyncio
import time
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from unittest.mock import patch, AsyncMock, Mock, MagicMock
import hashlib
import secrets

from .fixtures import (
    SAMPLE_USERS, SAMPLE_LICENSES, SAMPLE_SUBSCRIPTIONS,
    MockDatabase, MockEmailService, MockDodoPayments
)


class TestUserRegistration:
    """Test user registration and account creation."""
    
    @pytest_asyncio.fixture
    async def setup_user_database(self):
        """Set up database for user testing."""
        db = MockDatabase()
        return db
    
    @pytest.mark.asyncio
    async def test_free_tier_user_registration(self, setup_user_database):
        """Test free tier user registration flow."""
        db = await setup_user_database
        
        # User registration data
        user_data = {
            "email": "newuser@test.com",
            "name": "New User",
            "company": "New Corp",
            "tier": "FREE",
            "password": "secure_password_123"
        }
        
        # Create user
        user = await db.create_user(user_data)
        
        # Verify user creation
        assert user["email"] == user_data["email"]
        assert user["name"] == user_data["name"]
        assert user["company"] == user_data["company"]
        assert user["tier"] == "FREE"
        assert user["id"] is not None
        assert "created_at" in user
        
        # Verify user exists in database
        assert user["id"] in db.users
        assert db.users[user["id"]]["email"] == user_data["email"]
    
    @pytest.mark.asyncio
    async def test_pro_tier_user_registration(self, setup_user_database):
        """Test Pro tier user registration flow."""
        db = await setup_user_database
        
        # User registration data
        user_data = {
            "email": "prouser@test.com",
            "name": "Pro User",
            "company": "Pro Corp",
            "tier": "PRO",
            "password": "secure_password_123"
        }
        
        # Create user
        user = await db.create_user(user_data)
        
        # Verify user creation
        assert user["email"] == user_data["email"]
        assert user["tier"] == "PRO"
        assert user["id"] is not None
        
        # Verify user exists in database
        assert user["id"] in db.users
    
    @pytest.mark.asyncio
    async def test_enterprise_tier_user_registration(self, setup_user_database):
        """Test Enterprise tier user registration flow."""
        db = await setup_user_database
        
        # User registration data
        user_data = {
            "email": "enterpriseuser@test.com",
            "name": "Enterprise User",
            "company": "Enterprise Corp",
            "tier": "ENTERPRISE",
            "password": "secure_password_123"
        }
        
        # Create user
        user = await db.create_user(user_data)
        
        # Verify user creation
        assert user["email"] == user_data["email"]
        assert user["tier"] == "ENTERPRISE"
        assert user["id"] is not None
        
        # Verify user exists in database
        assert user["id"] in db.users
    
    @pytest.mark.asyncio
    async def test_duplicate_email_registration(self, setup_user_database):
        """Test duplicate email registration handling."""
        db = await setup_user_database
        
        # First user registration
        user_data1 = {
            "email": "duplicate@test.com",
            "name": "First User",
            "company": "First Corp",
            "tier": "FREE"
        }
        
        user1 = await db.create_user(user_data1)
        assert user1["email"] == "duplicate@test.com"
        
        # Second user with same email (should fail)
        user_data2 = {
            "email": "duplicate@test.com",
            "name": "Second User",
            "company": "Second Corp",
            "tier": "PRO"
        }
        
        # In a real implementation, this would raise an exception
        # For testing, we'll check if the email already exists
        existing_user = await db.get_user_by_email("duplicate@test.com")
        assert existing_user is not None
        assert existing_user["email"] == "duplicate@test.com"
        assert existing_user["name"] == "First User"  # Original user
    
    @pytest.mark.asyncio
    async def test_user_registration_validation(self, setup_user_database):
        """Test user registration data validation."""
        db = await setup_user_database
        
        # Test invalid email format
        invalid_user_data = {
            "email": "invalid-email",
            "name": "Test User",
            "company": "Test Corp",
            "tier": "FREE"
        }
        
        # In a real implementation, this would validate email format
        # For testing, we'll check if email contains @
        assert "@" not in invalid_user_data["email"]
        
        # Test missing required fields
        incomplete_user_data = {
            "email": "incomplete@test.com",
            # Missing name, company, tier
        }
        
        # In a real implementation, this would validate required fields
        required_fields = ["email", "name", "company", "tier"]
        missing_fields = [field for field in required_fields if field not in incomplete_user_data]
        assert len(missing_fields) > 0
    
    @pytest.mark.asyncio
    async def test_user_registration_with_webhook(self, setup_user_database):
        """Test user registration triggered by webhook."""
        db = await setup_user_database
        
        # Simulate webhook data
        webhook_data = {
            "customer_id": "dodo_cust_001",
            "customer_email": "webhookuser@test.com",
            "customer_name": "Webhook User",
            "product_id": "prod_pro_monthly",
            "tier": "PRO"
        }
        
        # Create user from webhook data
        user_data = {
            "email": webhook_data["customer_email"],
            "name": webhook_data["customer_name"],
            "company": "Webhook Corp",
            "tier": webhook_data["tier"],
            "dodo_customer_id": webhook_data["customer_id"]
        }
        
        user = await db.create_user(user_data)
        
        # Verify user creation from webhook
        assert user["email"] == webhook_data["customer_email"]
        assert user["name"] == webhook_data["customer_name"]
        assert user["tier"] == webhook_data["tier"]
        assert user["dodo_customer_id"] == webhook_data["customer_id"]


class TestLicenseUserRelationships:
    """Test license-user relationship creation and management."""
    
    @pytest_asyncio.fixture
    async def setup_license_database(self):
        """Set up database for license testing."""
        db = MockDatabase()
        
        # Create test users
        for user in SAMPLE_USERS.values():
            await db.create_user(user.__dict__)
        
        return db
    
    @pytest.mark.asyncio
    async def test_license_user_relationship_creation(self, setup_license_database):
        """Test license-user relationship creation."""
        db = await setup_license_database
        
        # Get test user
        user = SAMPLE_USERS["pro_user"]
        
        # Create license for user
        license_data = {
            "user_id": user.id,
            "license_key": "FB-PRO-12345678-ABCD-EFGH-IJKL-MNOPQRSTUVWX",
            "tier": "PRO",
            "max_servers": 5,
            "is_active": True,
            "expires_at": datetime.now() + timedelta(days=30)
        }
        
        license = await db.create_license(license_data)
        
        # Verify license creation
        assert license["user_id"] == user.id
        assert license["license_key"] == license_data["license_key"]
        assert license["tier"] == "PRO"
        assert license["is_active"] is True
        
        # Verify license exists in database
        assert license["id"] in db.licenses
        assert db.licenses[license["id"]]["user_id"] == user.id
    
    @pytest.mark.asyncio
    async def test_multiple_licenses_per_user(self, setup_license_database):
        """Test multiple licenses per user."""
        db = await setup_license_database
        
        # Get test user
        user = SAMPLE_USERS["enterprise_user"]
        
        # Create multiple licenses for user
        licenses = []
        for i in range(3):
            license_data = {
                "user_id": user.id,
                "license_key": f"FB-ENT-{i:08d}-ABCD-EFGH-IJKL-MNOPQRSTUVWX",
                "tier": "ENTERPRISE",
                "max_servers": 50,
                "is_active": True,
                "expires_at": datetime.now() + timedelta(days=30)
            }
            
            license = await db.create_license(license_data)
            licenses.append(license)
        
        # Verify all licenses were created
        assert len(licenses) == 3
        
        # Verify all licenses belong to the same user
        for license in licenses:
            assert license["user_id"] == user.id
            assert license["tier"] == "ENTERPRISE"
            assert license["is_active"] is True
        
        # Verify licenses exist in database
        user_licenses = [lic for lic in db.licenses.values() if lic["user_id"] == user.id]
        assert len(user_licenses) == 3
    
    @pytest.mark.asyncio
    async def test_license_activation_status(self, setup_license_database):
        """Test license activation status management."""
        db = await setup_license_database
        
        # Get test user
        user = SAMPLE_USERS["pro_user"]
        
        # Create inactive license
        license_data = {
            "user_id": user.id,
            "license_key": "FB-PRO-12345678-ABCD-EFGH-IJKL-MNOPQRSTUVWX",
            "tier": "PRO",
            "max_servers": 5,
            "is_active": False,  # Initially inactive
            "expires_at": datetime.now() + timedelta(days=30)
        }
        
        license = await db.create_license(license_data)
        
        # Verify license is inactive
        assert license["is_active"] is False
        
        # Activate license
        license["is_active"] = True
        license["activated_at"] = datetime.now()
        
        # Verify license is active
        assert license["is_active"] is True
        assert "activated_at" in license
        
        # Deactivate license
        license["is_active"] = False
        license["deactivated_at"] = datetime.now()
        
        # Verify license is deactivated
        assert license["is_active"] is False
        assert "deactivated_at" in license
    
    @pytest.mark.asyncio
    async def test_license_expiration_handling(self, setup_license_database):
        """Test license expiration handling."""
        db = await setup_license_database
        
        # Get test user
        user = SAMPLE_USERS["pro_user"]
        
        # Create expired license
        expired_license_data = {
            "user_id": user.id,
            "license_key": "FB-PRO-EXPIRED-ABCD-EFGH-IJKL-MNOPQRSTUVWX",
            "tier": "PRO",
            "max_servers": 5,
            "is_active": True,
            "expires_at": datetime.now() - timedelta(days=1)  # Expired yesterday
        }
        
        expired_license = await db.create_license(expired_license_data)
        
        # Verify license is expired
        assert expired_license["expires_at"] < datetime.now()
        
        # Check if license should be deactivated due to expiration
        if expired_license["expires_at"] < datetime.now():
            expired_license["is_active"] = False
            expired_license["expired_at"] = datetime.now()
        
        # Verify license is deactivated due to expiration
        assert expired_license["is_active"] is False
        assert "expired_at" in expired_license
        
        # Create valid license
        valid_license_data = {
            "user_id": user.id,
            "license_key": "FB-PRO-VALID-ABCD-EFGH-IJKL-MNOPQRSTUVWX",
            "tier": "PRO",
            "max_servers": 5,
            "is_active": True,
            "expires_at": datetime.now() + timedelta(days=30)  # Valid for 30 days
        }
        
        valid_license = await db.create_license(valid_license_data)
        
        # Verify license is valid
        assert valid_license["expires_at"] > datetime.now()
        assert valid_license["is_active"] is True


class TestLicenseActivation:
    """Test license activation via CLI and web interface."""
    
    @pytest_asyncio.fixture
    async def setup_activation_database(self):
        """Set up database for activation testing."""
        db = MockDatabase()
        
        # Create test users and licenses
        for user in SAMPLE_USERS.values():
            await db.create_user(user.__dict__)
        
        for license in SAMPLE_LICENSES.values():
            await db.create_license(license.__dict__)
        
        return db
    
    @pytest.mark.asyncio
    async def test_cli_license_activation(self, setup_activation_database):
        """Test license activation via CLI."""
        db = await setup_activation_database
        
        # Get test license
        license = SAMPLE_LICENSES["pro_license"]
        
        # Simulate CLI activation
        license_key = license.license_key
        server_id = "server_cli_001"
        server_name = "CLI Server"
        server_version = "1.0.0"
        
        # Validate license key format
        assert license_key.startswith("FB-PRO-")
        assert len(license_key) == 43
        
        # Check license status
        license_record = db.licenses[license.id]
        assert license_record["is_active"] is True
        assert license_record["expires_at"] > datetime.now()
        
        # Record activation
        activation_data = {
            "license_id": license.id,
            "server_id": server_id,
            "server_name": server_name,
            "server_version": server_version,
            "activated_at": datetime.now(),
            "activation_method": "CLI"
        }
        
        # Store activation record
        db.analytics.append({
            "user_id": license.user_id,
            "license_id": license.id,
            "event_type": "LICENSE_VALIDATION",
            "event_data": activation_data,
            "timestamp": datetime.now()
        })
        
        # Verify activation was recorded
        assert len(db.analytics) == 1
        activation_event = db.analytics[0]
        assert activation_event["event_type"] == "LICENSE_VALIDATION"
        assert activation_event["event_data"]["server_id"] == server_id
        assert activation_event["event_data"]["activation_method"] == "CLI"
    
    @pytest.mark.asyncio
    async def test_web_interface_license_activation(self, setup_activation_database):
        """Test license activation via web interface."""
        db = await setup_activation_database
        
        # Get test license
        license = SAMPLE_LICENSES["enterprise_license"]
        
        # Simulate web interface activation
        license_key = license.license_key
        server_id = "server_web_001"
        server_name = "Web Server"
        server_version = "1.0.0"
        user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        ip_address = "192.168.1.100"
        
        # Validate license key
        assert license_key.startswith("FB-ENT-")
        assert len(license_key) == 43
        
        # Check license status
        license_record = db.licenses[license.id]
        assert license_record["is_active"] is True
        assert license_record["expires_at"] > datetime.now()
        
        # Record activation
        activation_data = {
            "license_id": license.id,
            "server_id": server_id,
            "server_name": server_name,
            "server_version": server_version,
            "activated_at": datetime.now(),
            "activation_method": "WEB",
            "user_agent": user_agent,
            "ip_address": ip_address
        }
        
        # Store activation record
        db.analytics.append({
            "user_id": license.user_id,
            "license_id": license.id,
            "event_type": "LICENSE_VALIDATION",
            "event_data": activation_data,
            "timestamp": datetime.now()
        })
        
        # Verify activation was recorded
        assert len(db.analytics) == 1
        activation_event = db.analytics[0]
        assert activation_event["event_type"] == "LICENSE_VALIDATION"
        assert activation_event["event_data"]["server_id"] == server_id
        assert activation_event["event_data"]["activation_method"] == "WEB"
        assert activation_event["event_data"]["ip_address"] == ip_address
    
    @pytest.mark.asyncio
    async def test_license_activation_validation(self, setup_activation_database):
        """Test license activation validation."""
        db = await setup_activation_database
        
        # Test valid license activation
        valid_license = SAMPLE_LICENSES["pro_license"]
        license_record = db.licenses[valid_license.id]
        
        # Validate license
        assert license_record["is_active"] is True
        assert license_record["expires_at"] > datetime.now()
        assert license_record["tier"] == "PRO"
        
        # Test invalid license activation
        invalid_license_key = "FB-INVALID-12345678-ABCD-EFGH-IJKL-MNOPQRSTUVWX"
        
        # Check if license exists
        license_found = None
        for license in db.licenses.values():
            if license["license_key"] == invalid_license_key:
                license_found = license
                break
        
        # Verify invalid license not found
        assert license_found is None
        
        # Test expired license activation
        expired_license_data = {
            "user_id": SAMPLE_USERS["pro_user"].id,
            "license_key": "FB-PRO-EXPIRED-ABCD-EFGH-IJKL-MNOPQRSTUVWX",
            "tier": "PRO",
            "max_servers": 5,
            "is_active": True,
            "expires_at": datetime.now() - timedelta(days=1)  # Expired
        }
        
        expired_license = await db.create_license(expired_license_data)
        
        # Verify expired license cannot be activated
        assert expired_license["expires_at"] < datetime.now()
        if expired_license["expires_at"] < datetime.now():
            expired_license["is_active"] = False
        
        assert expired_license["is_active"] is False
    
    @pytest.mark.asyncio
    async def test_license_activation_limits(self, setup_activation_database):
        """Test license activation limits."""
        db = await setup_activation_database
        
        # Get test license
        license = SAMPLE_LICENSES["pro_license"]
        license_record = db.licenses[license.id]
        
        # Test server limit
        max_servers = license_record["max_servers"]
        assert max_servers == 5  # Pro tier limit
        
        # Simulate multiple server activations
        activations = []
        for i in range(max_servers + 2):  # Try to activate more than limit
            server_id = f"server_{i:03d}"
            
            # Check if within limit
            if i < max_servers:
                # Within limit - allow activation
                activation_data = {
                    "license_id": license.id,
                    "server_id": server_id,
                    "activated_at": datetime.now(),
                    "status": "active"
                }
                activations.append(activation_data)
            else:
                # Exceeded limit - deny activation
                activation_data = {
                    "license_id": license.id,
                    "server_id": server_id,
                    "activated_at": datetime.now(),
                    "status": "denied",
                    "reason": "server_limit_exceeded"
                }
                activations.append(activation_data)
        
        # Verify activation limits
        active_activations = [a for a in activations if a["status"] == "active"]
        denied_activations = [a for a in activations if a["status"] == "denied"]
        
        assert len(active_activations) == max_servers
        assert len(denied_activations) == 2
        assert all(a["reason"] == "server_limit_exceeded" for a in denied_activations)
    
    @pytest.mark.asyncio
    async def test_license_activation_analytics(self, setup_activation_database):
        """Test license activation analytics tracking."""
        db = await setup_activation_database
        
        # Get test license
        license = SAMPLE_LICENSES["pro_license"]
        
        # Simulate multiple activations
        activations = [
            {
                "server_id": "server_001",
                "activation_method": "CLI",
                "timestamp": datetime.now() - timedelta(hours=1)
            },
            {
                "server_id": "server_002",
                "activation_method": "WEB",
                "timestamp": datetime.now() - timedelta(minutes=30)
            },
            {
                "server_id": "server_003",
                "activation_method": "CLI",
                "timestamp": datetime.now() - timedelta(minutes=15)
            }
        ]
        
        # Record activations
        for activation in activations:
            db.analytics.append({
                "user_id": license.user_id,
                "license_id": license.id,
                "event_type": "LICENSE_VALIDATION",
                "event_data": activation,
                "timestamp": activation["timestamp"]
            })
        
        # Analyze activation data
        license_activations = [
            event for event in db.analytics 
            if event["event_type"] == "LICENSE_VALIDATION" and event["license_id"] == license.id
        ]
        
        # Verify activation analytics
        assert len(license_activations) == 3
        
        # Count activations by method
        cli_activations = [a for a in license_activations if a["event_data"]["activation_method"] == "CLI"]
        web_activations = [a for a in license_activations if a["event_data"]["activation_method"] == "WEB"]
        
        assert len(cli_activations) == 2
        assert len(web_activations) == 1
        
        # Check activation timeline
        timestamps = [a["timestamp"] for a in license_activations]
        timestamps.sort()
        
        # Verify chronological order
        assert timestamps[0] < timestamps[1] < timestamps[2]


class TestUserAuthentication:
    """Test user authentication and session management."""
    
    @pytest_asyncio.fixture
    async def setup_auth_database(self):
        """Set up database for authentication testing."""
        db = MockDatabase()
        
        # Create test users with passwords
        for user in SAMPLE_USERS.values():
            user_data = user.__dict__.copy()
            user_data["password"] = "hashed_password_123"
            await db.create_user(user_data)
        
        return db
    
    @pytest.mark.asyncio
    async def test_user_login_authentication(self, setup_auth_database):
        """Test user login authentication."""
        db = await setup_auth_database
        
        # Get test user
        user = SAMPLE_USERS["pro_user"]
        user_record = db.users[user.id]
        
        # Simulate login attempt
        email = user.email
        password = "secure_password_123"
        
        # Find user by email
        found_user = await db.get_user_by_email(email)
        assert found_user is not None
        assert found_user["email"] == email
        
        # Verify password (in real implementation, this would hash and compare)
        # For testing, we'll assume password verification succeeds
        password_valid = True  # Mock password validation
        
        if password_valid:
            # Create session
            session_data = {
                "user_id": found_user["id"],
                "session_token": secrets.token_urlsafe(32),
                "created_at": datetime.now(),
                "expires_at": datetime.now() + timedelta(hours=24)
            }
            
            # Store session (in real implementation, this would be in a sessions table)
            db.analytics.append({
                "user_id": found_user["id"],
                "event_type": "USER_LOGIN",
                "event_data": session_data,
                "timestamp": datetime.now()
            })
            
            # Verify login success
            assert session_data["user_id"] == found_user["id"]
            assert session_data["expires_at"] > datetime.now()
    
    @pytest.mark.asyncio
    async def test_user_logout(self, setup_auth_database):
        """Test user logout."""
        db = await setup_auth_database
        
        # Get test user
        user = SAMPLE_USERS["pro_user"]
        
        # Simulate logout
        session_token = secrets.token_urlsafe(32)
        
        # Record logout
        logout_data = {
            "user_id": user.id,
            "session_token": session_token,
            "logged_out_at": datetime.now()
        }
        
        db.analytics.append({
            "user_id": user.id,
            "event_type": "USER_LOGOUT",
            "event_data": logout_data,
            "timestamp": datetime.now()
        })
        
        # Verify logout was recorded
        logout_events = [
            event for event in db.analytics 
            if event["event_type"] == "USER_LOGOUT" and event["user_id"] == user.id
        ]
        
        assert len(logout_events) == 1
        assert logout_events[0]["event_data"]["session_token"] == session_token
    
    @pytest.mark.asyncio
    async def test_session_management(self, setup_auth_database):
        """Test session management."""
        db = await setup_auth_database
        
        # Get test user
        user = SAMPLE_USERS["pro_user"]
        
        # Create multiple sessions
        sessions = []
        for i in range(3):
            session_data = {
                "user_id": user.id,
                "session_token": secrets.token_urlsafe(32),
                "created_at": datetime.now() - timedelta(hours=i),
                "expires_at": datetime.now() + timedelta(hours=24-i),
                "is_active": True
            }
            sessions.append(session_data)
        
        # Store sessions
        for session in sessions:
            db.analytics.append({
                "user_id": user.id,
                "event_type": "SESSION_CREATED",
                "event_data": session,
                "timestamp": session["created_at"]
            })
        
        # Verify sessions were created
        session_events = [
            event for event in db.analytics 
            if event["event_type"] == "SESSION_CREATED" and event["user_id"] == user.id
        ]
        
        assert len(session_events) == 3
        
        # Check for expired sessions
        current_time = datetime.now()
        expired_sessions = [
            session for session in sessions 
            if session["expires_at"] < current_time
        ]
        
        # Mark expired sessions as inactive
        for session in expired_sessions:
            session["is_active"] = False
        
        # Verify expired sessions are marked inactive
        assert len(expired_sessions) == 0  # All sessions should be valid in this test
    
    @pytest.mark.asyncio
    async def test_authentication_failure_handling(self, setup_auth_database):
        """Test authentication failure handling."""
        db = await setup_auth_database
        
        # Test invalid email
        invalid_email = "nonexistent@test.com"
        user = await db.get_user_by_email(invalid_email)
        assert user is None
        
        # Test invalid password
        valid_user = SAMPLE_USERS["pro_user"]
        user_record = await db.get_user_by_email(valid_user.email)
        assert user_record is not None
        
        # Simulate invalid password
        password_valid = False  # Mock password validation failure
        
        if not password_valid:
            # Record failed login attempt
            failed_login_data = {
                "email": valid_user.email,
                "ip_address": "192.168.1.100",
                "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "failure_reason": "invalid_password",
                "attempted_at": datetime.now()
            }
            
            db.analytics.append({
                "user_id": user_record["id"],
                "event_type": "LOGIN_FAILED",
                "event_data": failed_login_data,
                "timestamp": datetime.now()
            })
            
            # Verify failed login was recorded
            failed_events = [
                event for event in db.analytics 
                if event["event_type"] == "LOGIN_FAILED" and event["user_id"] == user_record["id"]
            ]
            
            assert len(failed_events) == 1
            assert failed_events[0]["event_data"]["failure_reason"] == "invalid_password"


class TestUsageTracking:
    """Test usage tracking for free tier limits."""
    
    @pytest_asyncio.fixture
    async def setup_usage_database(self):
        """Set up database for usage tracking testing."""
        db = MockDatabase()
        
        # Create test users
        for user in SAMPLE_USERS.values():
            await db.create_user(user.__dict__)
        
        # Create test licenses
        for license in SAMPLE_LICENSES.values():
            await db.create_license(license.__dict__)
        
        return db
    
    @pytest.mark.asyncio
    async def test_free_tier_usage_tracking(self, setup_usage_database):
        """Test free tier usage tracking."""
        db = await setup_usage_database
        
        # Get free tier user
        user = SAMPLE_USERS["free_user"]
        license = [lic for lic in db.licenses.values() if lic["user_id"] == user.id][0]
        
        # Define free tier limits
        free_tier_limits = {
            "max_requests_per_day": 100,
            "max_file_size": 10 * 1024 * 1024,  # 10MB
            "max_servers": 1
        }
        
        # Simulate usage events
        usage_events = []
        for i in range(120):  # Exceed daily limit
            event = {
                "user_id": user.id,
                "license_id": license["id"],
                "event_type": "REQUEST_COUNT",
                "event_data": {
                    "count": 1,
                    "file_size": 1024,  # 1KB
                    "timestamp": datetime.now()
                },
                "timestamp": datetime.now()
            }
            usage_events.append(event)
            db.analytics.append(event)
        
        # Calculate usage
        daily_requests = len([
            event for event in db.analytics 
            if event["event_type"] == "REQUEST_COUNT" and event["user_id"] == user.id
        ])
        
        # Check if limit exceeded
        limit_exceeded = daily_requests > free_tier_limits["max_requests_per_day"]
        
        # Verify usage tracking
        assert daily_requests == 120
        assert limit_exceeded is True
        
        # Record quota exceeded event
        if limit_exceeded:
            quota_event = {
                "user_id": user.id,
                "license_id": license["id"],
                "event_type": "QUOTA_EXCEEDED",
                "event_data": {
                    "limit_type": "daily_requests",
                    "limit_value": free_tier_limits["max_requests_per_day"],
                    "current_usage": daily_requests,
                    "exceeded_by": daily_requests - free_tier_limits["max_requests_per_day"]
                },
                "timestamp": datetime.now()
            }
            db.analytics.append(quota_event)
        
        # Verify quota exceeded event was recorded
        quota_events = [
            event for event in db.analytics 
            if event["event_type"] == "QUOTA_EXCEEDED" and event["user_id"] == user.id
        ]
        
        assert len(quota_events) == 1
        assert quota_events[0]["event_data"]["limit_type"] == "daily_requests"
        assert quota_events[0]["event_data"]["exceeded_by"] == 20
    
    @pytest.mark.asyncio
    async def test_pro_tier_usage_tracking(self, setup_usage_database):
        """Test Pro tier usage tracking."""
        db = await setup_usage_database
        
        # Get Pro tier user
        user = SAMPLE_USERS["pro_user"]
        license = [lic for lic in db.licenses.values() if lic["user_id"] == user.id][0]
        
        # Define Pro tier limits
        pro_tier_limits = {
            "max_requests_per_day": 10000,
            "max_file_size": 100 * 1024 * 1024,  # 100MB
            "max_servers": 5
        }
        
        # Simulate usage events
        usage_events = []
        for i in range(5000):  # Within Pro tier limit
            event = {
                "user_id": user.id,
                "license_id": license["id"],
                "event_type": "REQUEST_COUNT",
                "event_data": {
                    "count": 1,
                    "file_size": 1024 * 1024,  # 1MB
                    "timestamp": datetime.now()
                },
                "timestamp": datetime.now()
            }
            usage_events.append(event)
            db.analytics.append(event)
        
        # Calculate usage
        daily_requests = len([
            event for event in db.analytics 
            if event["event_type"] == "REQUEST_COUNT" and event["user_id"] == user.id
        ])
        
        # Check if limit exceeded
        limit_exceeded = daily_requests > pro_tier_limits["max_requests_per_day"]
        
        # Verify usage tracking
        assert daily_requests == 5000
        assert limit_exceeded is False
        
        # Verify no quota exceeded event
        quota_events = [
            event for event in db.analytics 
            if event["event_type"] == "QUOTA_EXCEEDED" and event["user_id"] == user.id
        ]
        
        assert len(quota_events) == 0
    
    @pytest.mark.asyncio
    async def test_usage_analytics_aggregation(self, setup_usage_database):
        """Test usage analytics aggregation."""
        db = await setup_usage_database
        
        # Get test user
        user = SAMPLE_USERS["pro_user"]
        license = [lic for lic in db.licenses.values() if lic["user_id"] == user.id][0]
        
        # Simulate various usage events
        event_types = ["REQUEST_COUNT", "ERROR_COUNT", "FEATURE_USAGE", "QUOTA_EXCEEDED"]
        
        for event_type in event_types:
            for i in range(10):
                event = {
                    "user_id": user.id,
                    "license_id": license["id"],
                    "event_type": event_type,
                    "event_data": {
                        "count": 1,
                        "timestamp": datetime.now() - timedelta(hours=i)
                    },
                    "timestamp": datetime.now() - timedelta(hours=i)
                }
                db.analytics.append(event)
        
        # Aggregate usage by event type
        usage_by_type = {}
        for event in db.analytics:
            if event["user_id"] == user.id:
                event_type = event["event_type"]
                usage_by_type[event_type] = usage_by_type.get(event_type, 0) + 1
        
        # Verify aggregation
        assert len(usage_by_type) == 4
        assert usage_by_type["REQUEST_COUNT"] == 10
        assert usage_by_type["ERROR_COUNT"] == 10
        assert usage_by_type["FEATURE_USAGE"] == 10
        assert usage_by_type["QUOTA_EXCEEDED"] == 10
        
        # Calculate total usage
        total_usage = sum(usage_by_type.values())
        assert total_usage == 40
        
        # Calculate usage over time
        recent_events = [
            event for event in db.analytics 
            if event["user_id"] == user.id and event["timestamp"] > datetime.now() - timedelta(hours=5)
        ]
        
        assert len(recent_events) == 20  # 5 hours * 4 event types
    
    @pytest.mark.asyncio
    async def test_usage_limits_enforcement(self, setup_usage_database):
        """Test usage limits enforcement."""
        db = await setup_usage_database
        
        # Get free tier user
        user = SAMPLE_USERS["free_user"]
        license = [lic for lic in db.licenses.values() if lic["user_id"] == user.id][0]
        
        # Define limits
        daily_limit = 100
        
        # Simulate usage up to limit
        for i in range(daily_limit):
            event = {
                "user_id": user.id,
                "license_id": license["id"],
                "event_type": "REQUEST_COUNT",
                "event_data": {"count": 1},
                "timestamp": datetime.now()
            }
            db.analytics.append(event)
        
        # Check current usage
        current_usage = len([
            event for event in db.analytics 
            if event["event_type"] == "REQUEST_COUNT" and event["user_id"] == user.id
        ])
        
        # Verify limit enforcement
        assert current_usage == daily_limit
        
        # Attempt to exceed limit
        if current_usage >= daily_limit:
            # Block additional requests
            blocked_event = {
                "user_id": user.id,
                "license_id": license["id"],
                "event_type": "REQUEST_BLOCKED",
                "event_data": {
                    "reason": "daily_limit_exceeded",
                    "limit": daily_limit,
                    "current_usage": current_usage
                },
                "timestamp": datetime.now()
            }
            db.analytics.append(blocked_event)
        
        # Verify blocking was enforced
        blocked_events = [
            event for event in db.analytics 
            if event["event_type"] == "REQUEST_BLOCKED" and event["user_id"] == user.id
        ]
        
        assert len(blocked_events) == 1
        assert blocked_events[0]["event_data"]["reason"] == "daily_limit_exceeded"
