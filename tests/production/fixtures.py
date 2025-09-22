"""
Test fixtures and mock data for production validation tests.

This module provides comprehensive test data, mock services, and fixtures
for testing production-critical functionality.
"""

import os
import json
import tempfile
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from unittest.mock import Mock, AsyncMock, patch
import pytest
import pytest_asyncio
from dataclasses import dataclass

# Test data fixtures
@dataclass
class TestUser:
    id: str
    email: str
    name: str
    company: str
    tier: str
    dodo_customer_id: str

@dataclass
class TestSubscription:
    id: str
    dodo_subscription_id: str
    dodo_customer_id: str
    dodo_product_id: str
    tier: str
    status: str
    current_period_start: datetime
    current_period_end: datetime
    amount: int
    currency: str

@dataclass
class TestLicense:
    id: str
    license_key: str
    tier: str
    user_id: str
    subscription_id: str
    expires_at: datetime
    is_active: bool

# Sample test data
SAMPLE_USERS = {
    "free_user": TestUser(
        id="user_free_001",
        email="free@test.com",
        name="Free User",
        company="Test Corp",
        tier="FREE",
        dodo_customer_id="dodo_cust_free_001"
    ),
    "pro_user": TestUser(
        id="user_pro_001",
        email="pro@test.com",
        name="Pro User",
        company="Pro Corp",
        tier="PRO",
        dodo_customer_id="dodo_cust_pro_001"
    ),
    "enterprise_user": TestUser(
        id="user_enterprise_001",
        email="enterprise@test.com",
        name="Enterprise User",
        company="Enterprise Corp",
        tier="ENTERPRISE",
        dodo_customer_id="dodo_cust_enterprise_001"
    )
}

SAMPLE_SUBSCRIPTIONS = {
    "pro_subscription": TestSubscription(
        id="sub_pro_001",
        dodo_subscription_id="dodo_sub_pro_001",
        dodo_customer_id="dodo_cust_pro_001",
        dodo_product_id="prod_pro_monthly",
        tier="PRO",
        status="active",
        current_period_start=datetime.now(),
        current_period_end=datetime.now() + timedelta(days=30),
        amount=1900,  # $19.00
        currency="USD"
    ),
    "enterprise_subscription": TestSubscription(
        id="sub_enterprise_001",
        dodo_subscription_id="dodo_sub_enterprise_001",
        dodo_customer_id="dodo_cust_enterprise_001",
        dodo_product_id="prod_enterprise_monthly",
        tier="ENTERPRISE",
        status="active",
        current_period_start=datetime.now(),
        current_period_end=datetime.now() + timedelta(days=30),
        amount=9900,  # $99.00
        currency="USD"
    )
}

SAMPLE_LICENSES = {
    "pro_license": TestLicense(
        id="lic_pro_001",
        license_key="FB-PRO-12345678-ABCD-EFGH-IJKL-MNOPQRSTUVWX",
        tier="PRO",
        user_id="user_pro_001",
        subscription_id="sub_pro_001",
        expires_at=datetime.now() + timedelta(days=30),
        is_active=True
    ),
    "enterprise_license": TestLicense(
        id="lic_enterprise_001",
        license_key="FB-ENT-87654321-WXYZ-ABCD-EFGH-IJKLMNOPQRST",
        tier="ENTERPRISE",
        user_id="user_enterprise_001",
        subscription_id="sub_enterprise_001",
        expires_at=datetime.now() + timedelta(days=30),
        is_active=True
    )
}

# Dodo webhook event samples
DODO_WEBHOOK_EVENTS = {
    "subscription_created": {
        "id": "evt_sub_created_001",
        "type": "subscription.created",
        "data": {
            "object": {
                "id": "dodo_sub_pro_001",
                "customer_id": "dodo_cust_pro_001",
                "customer_email": "pro@test.com",
                "product_id": "prod_pro_monthly",
                "product_name": "FileBridge Pro",
                "status": "active",
                "current_period_start": int(datetime.now().timestamp()),
                "current_period_end": int((datetime.now() + timedelta(days=30)).timestamp()),
                "amount": 1900,
                "currency": "USD"
            }
        },
        "created": int(datetime.now().timestamp()),
        "livemode": False
    },
    "subscription_activated": {
        "id": "evt_sub_activated_001",
        "type": "subscription.activated",
        "data": {
            "object": {
                "id": "dodo_sub_pro_001",
                "customer_id": "dodo_cust_pro_001",
                "customer_email": "pro@test.com",
                "product_id": "prod_pro_monthly",
                "product_name": "FileBridge Pro",
                "status": "active",
                "current_period_start": int(datetime.now().timestamp()),
                "current_period_end": int((datetime.now() + timedelta(days=30)).timestamp()),
                "amount": 1900,
                "currency": "USD"
            }
        },
        "created": int(datetime.now().timestamp()),
        "livemode": False
    },
    "subscription_cancelled": {
        "id": "evt_sub_cancelled_001",
        "type": "subscription.cancelled",
        "data": {
            "object": {
                "id": "dodo_sub_pro_001",
                "customer_id": "dodo_cust_pro_001",
                "customer_email": "pro@test.com",
                "product_id": "prod_pro_monthly",
                "product_name": "FileBridge Pro",
                "status": "cancelled",
                "canceled_at": int(datetime.now().timestamp()),
                "cancellation_reason": "user_requested"
            }
        },
        "created": int(datetime.now().timestamp()),
        "livemode": False
    },
    "payment_succeeded": {
        "id": "evt_payment_succeeded_001",
        "type": "payment.succeeded",
        "data": {
            "object": {
                "id": "dodo_payment_001",
                "subscription_id": "dodo_sub_pro_001",
                "customer_id": "dodo_cust_pro_001",
                "amount": 1900,
                "currency": "USD",
                "status": "succeeded",
                "paid_at": int(datetime.now().timestamp())
            }
        },
        "created": int(datetime.now().timestamp()),
        "livemode": False
    },
    "payment_failed": {
        "id": "evt_payment_failed_001",
        "type": "payment.failed",
        "data": {
            "object": {
                "id": "dodo_payment_002",
                "subscription_id": "dodo_sub_pro_001",
                "customer_id": "dodo_cust_pro_001",
                "amount": 1900,
                "currency": "USD",
                "status": "failed",
                "failure_reason": "insufficient_funds",
                "failed_at": int(datetime.now().timestamp())
            }
        },
        "created": int(datetime.now().timestamp()),
        "livemode": False
    }
}

# Email template test data
EMAIL_TEMPLATE_DATA = {
    "license_key": {
        "to": "pro@test.com",
        "customer_name": "Pro User",
        "license_key": "FB-PRO-12345678-ABCD-EFGH-IJKL-MNOPQRSTUVWX",
        "plan": "PRO",
        "subscription_id": "dodo_sub_pro_001",
        "expires_at": datetime.now() + timedelta(days=30),
        "download_url": "https://releases.filebridge.com/latest",
        "support_email": "support@filebridge.com"
    },
    "welcome": {
        "to": "pro@test.com",
        "customer_name": "Pro User",
        "plan": "PRO",
        "features": [
            "Unlimited file transfers",
            "Advanced security features",
            "Priority support",
            "Custom integrations"
        ],
        "setup_url": "https://app.filebridge.com/setup",
        "support_email": "support@filebridge.com"
    },
    "payment_failed": {
        "to": "pro@test.com",
        "customer_name": "Pro User",
        "plan": "PRO",
        "amount": "$19.00",
        "currency": "USD",
        "failure_reason": "insufficient_funds",
        "retry_url": "https://app.filebridge.com/billing/retry",
        "support_email": "support@filebridge.com"
    }
}

# Database performance test data
PERFORMANCE_TEST_DATA = {
    "bulk_users": [
        {
            "id": f"user_bulk_{i:06d}",
            "email": f"bulk{i:06d}@test.com",
            "name": f"Bulk User {i}",
            "company": f"Bulk Corp {i}",
            "tier": "FREE" if i % 3 == 0 else "PRO" if i % 3 == 1 else "ENTERPRISE",
            "dodo_customer_id": f"dodo_cust_bulk_{i:06d}"
        }
        for i in range(1000)
    ],
    "bulk_subscriptions": [
        {
            "id": f"sub_bulk_{i:06d}",
            "dodo_subscription_id": f"dodo_sub_bulk_{i:06d}",
            "dodo_customer_id": f"dodo_cust_bulk_{i:06d}",
            "dodo_product_id": "prod_pro_monthly" if i % 2 == 0 else "prod_enterprise_monthly",
            "tier": "PRO" if i % 2 == 0 else "ENTERPRISE",
            "status": "active",
            "current_period_start": datetime.now(),
            "current_period_end": datetime.now() + timedelta(days=30),
            "amount": 1900 if i % 2 == 0 else 9900,
            "currency": "USD"
        }
        for i in range(1000)
    ]
}

# Mock services
class MockDodoPayments:
    """Mock Dodo Payments service for testing."""
    
    def __init__(self):
        self.products = {
            "prod_pro_monthly": {
                "id": "prod_pro_monthly",
                "name": "FileBridge Pro",
                "metadata": {"tier": "PRO"}
            },
            "prod_enterprise_monthly": {
                "id": "prod_enterprise_monthly",
                "name": "FileBridge Enterprise",
                "metadata": {"tier": "ENTERPRISE"}
            }
        }
        self.subscriptions = {}
        self.customers = {}
        self.payments = {}
    
    async def get_product(self, product_id: str) -> Dict[str, Any]:
        return self.products.get(product_id, {})
    
    async def get_subscription(self, subscription_id: str) -> Dict[str, Any]:
        return self.subscriptions.get(subscription_id, {})
    
    async def get_customer(self, customer_id: str) -> Dict[str, Any]:
        return self.customers.get(customer_id, {})
    
    async def generate_license_key(self, subscription_id: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        tier = metadata.get("tier", "PRO")
        license_key = f"FB-{tier[:3].upper()}-{subscription_id[-8:]}-{metadata.get('userId', '')[-8:]}"
        return {
            "license_key": license_key,
            "subscription_id": subscription_id,
            "metadata": metadata
        }
    
    def verify_webhook_signature(self, payload: str, signature: str, secret: str) -> bool:
        # Mock signature verification - always return True for testing
        return True

class MockEmailService:
    """Mock email service for testing."""
    
    def __init__(self):
        self.sent_emails = []
        self.delivery_failures = []
    
    async def send_license_key(self, data: Dict[str, Any]) -> Dict[str, Any]:
        email_record = {
            "type": "license_key",
            "to": data["to"],
            "sent_at": datetime.now(),
            "data": data
        }
        self.sent_emails.append(email_record)
        
        # Simulate occasional delivery failures for testing
        if data["to"].endswith("@fail.com"):
            self.delivery_failures.append(email_record)
            return {"success": False, "error": "Delivery failed"}
        
        return {"success": True, "message_id": f"msg_{len(self.sent_emails)}"}
    
    async def send_welcome_email(self, data: Dict[str, Any]) -> Dict[str, Any]:
        email_record = {
            "type": "welcome",
            "to": data["to"],
            "sent_at": datetime.now(),
            "data": data
        }
        self.sent_emails.append(email_record)
        return {"success": True, "message_id": f"msg_{len(self.sent_emails)}"}
    
    async def send_payment_failed_email(self, data: Dict[str, Any]) -> Dict[str, Any]:
        email_record = {
            "type": "payment_failed",
            "to": data["to"],
            "sent_at": datetime.now(),
            "data": data
        }
        self.sent_emails.append(email_record)
        return {"success": True, "message_id": f"msg_{len(self.sent_emails)}"}

class MockDatabase:
    """Mock database for testing."""
    
    def __init__(self):
        self.users = {}
        self.subscriptions = {}
        self.licenses = {}
        self.payments = {}
        self.webhook_events = {}
        self.analytics = []
    
    async def create_user(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        user_id = user_data.get("id", f"user_{len(self.users) + 1}")
        user = {**user_data, "id": user_id, "created_at": datetime.now()}
        self.users[user_id] = user
        return user
    
    async def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        for user in self.users.values():
            if user.get("email") == email:
                return user
        return None
    
    async def get_user_by_dodo_customer_id(self, customer_id: str) -> Optional[Dict[str, Any]]:
        for user in self.users.values():
            if user.get("dodo_customer_id") == customer_id:
                return user
        return None
    
    async def create_subscription(self, subscription_data: Dict[str, Any]) -> Dict[str, Any]:
        sub_id = subscription_data.get("id", f"sub_{len(self.subscriptions) + 1}")
        subscription = {**subscription_data, "id": sub_id, "created_at": datetime.now()}
        self.subscriptions[sub_id] = subscription
        return subscription
    
    async def create_license(self, license_data: Dict[str, Any]) -> Dict[str, Any]:
        license_id = license_data.get("id", f"lic_{len(self.licenses) + 1}")
        license = {**license_data, "id": license_id, "created_at": datetime.now()}
        self.licenses[license_id] = license
        return license
    
    async def create_payment(self, payment_data: Dict[str, Any]) -> Dict[str, Any]:
        payment_id = payment_data.get("id", f"pay_{len(self.payments) + 1}")
        payment = {**payment_data, "id": payment_id, "created_at": datetime.now()}
        self.payments[payment_id] = payment
        return payment
    
    async def store_webhook_event(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        event_id = event_data.get("id", f"evt_{len(self.webhook_events) + 1}")
        event = {**event_data, "id": event_id, "created_at": datetime.now()}
        self.webhook_events[event_id] = event
        return event
    
    async def get_webhook_event(self, event_id: str) -> Optional[Dict[str, Any]]:
        return self.webhook_events.get(event_id)
    
    async def update_webhook_event(self, event_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        if event_id in self.webhook_events:
            self.webhook_events[event_id].update(updates)
            return self.webhook_events[event_id]
        return {}

# Pytest fixtures
@pytest.fixture
def mock_dodo_payments():
    """Mock Dodo Payments service."""
    return MockDodoPayments()

@pytest.fixture
def mock_email_service():
    """Mock email service."""
    return MockEmailService()

@pytest.fixture
def mock_database():
    """Mock database."""
    return MockDatabase()

@pytest.fixture
def sample_user():
    """Sample user for testing."""
    return SAMPLE_USERS["pro_user"]

@pytest.fixture
def sample_subscription():
    """Sample subscription for testing."""
    return SAMPLE_SUBSCRIPTIONS["pro_subscription"]

@pytest.fixture
def sample_license():
    """Sample license for testing."""
    return SAMPLE_LICENSES["pro_license"]

@pytest.fixture
def dodo_webhook_event():
    """Sample Dodo webhook event."""
    return DODO_WEBHOOK_EVENTS["subscription_created"]

@pytest.fixture
def email_template_data():
    """Sample email template data."""
    return EMAIL_TEMPLATE_DATA["license_key"]

@pytest.fixture
def performance_test_data():
    """Performance test data."""
    return PERFORMANCE_TEST_DATA

@pytest.fixture
def temp_test_dir():
    """Temporary directory for test files."""
    with tempfile.TemporaryDirectory() as temp_dir:
        yield temp_dir

@pytest.fixture
def test_env_vars():
    """Test environment variables."""
    test_vars = {
        "NODE_ENV": "test",
        "DATABASE_URL": "file:./test.db",
        "DODO_WEBHOOK_SECRET": "test_webhook_secret",
        "DODO_PRO_PRODUCT_ID": "prod_pro_monthly",
        "DODO_ENTERPRISE_PRODUCT_ID": "prod_enterprise_monthly",
        "SENDGRID_API_KEY": "test_sendgrid_key",
        "SUPPORT_EMAIL": "support@test.com",
        "JWT_SECRET": "test_jwt_secret"
    }
    
    # Set environment variables
    for key, value in test_vars.items():
        os.environ[key] = value
    
    yield test_vars
    
    # Clean up
    for key in test_vars.keys():
        if key in os.environ:
            del os.environ[key]

@pytest.fixture
def mock_webhook_signature():
    """Mock webhook signature verification."""
    with patch('src.services.dodo.webhookHandler.dodoPayments.verifyWebhookSignature') as mock_verify:
        mock_verify.return_value = True
        yield mock_verify

@pytest.fixture
def mock_email_delivery():
    """Mock email delivery service."""
    with patch('src.services.email.productionEmailService.ProductionEmailService.sendLicenseKey') as mock_send:
        mock_send.return_value = {"success": True, "message_id": "test_msg_001"}
        yield mock_send

@pytest.fixture
def mock_database_operations():
    """Mock database operations."""
    with patch('src.services.user.userManagementService.prisma') as mock_prisma:
        mock_prisma.user.create = AsyncMock()
        mock_prisma.user.findUnique = AsyncMock()
        mock_prisma.subscription.create = AsyncMock()
        mock_prisma.subscription.findUnique = AsyncMock()
        mock_prisma.license.create = AsyncMock()
        mock_prisma.payment.create = AsyncMock()
        mock_prisma.webhookEvent.upsert = AsyncMock()
        mock_prisma.webhookEvent.findUnique = AsyncMock()
        mock_prisma.webhookEvent.update = AsyncMock()
        yield mock_prisma

# Async fixtures for asyncio tests
@pytest_asyncio.fixture
async def async_mock_database():
    """Async mock database."""
    return MockDatabase()

@pytest_asyncio.fixture
async def async_mock_email_service():
    """Async mock email service."""
    return MockEmailService()

@pytest_asyncio.fixture
async def async_mock_dodo_payments():
    """Async mock Dodo Payments service."""
    return MockDodoPayments()

# Test data generators
def generate_test_users(count: int, tier: str = "FREE") -> List[Dict[str, Any]]:
    """Generate test users for performance testing."""
    users = []
    for i in range(count):
        users.append({
            "id": f"user_test_{i:06d}",
            "email": f"test{i:06d}@example.com",
            "name": f"Test User {i}",
            "company": f"Test Company {i}",
            "tier": tier,
            "dodo_customer_id": f"dodo_cust_test_{i:06d}",
            "created_at": datetime.now()
        })
    return users

def generate_test_subscriptions(count: int, tier: str = "PRO") -> List[Dict[str, Any]]:
    """Generate test subscriptions for performance testing."""
    subscriptions = []
    for i in range(count):
        subscriptions.append({
            "id": f"sub_test_{i:06d}",
            "dodo_subscription_id": f"dodo_sub_test_{i:06d}",
            "dodo_customer_id": f"dodo_cust_test_{i:06d}",
            "dodo_product_id": f"prod_{tier.lower()}_monthly",
            "tier": tier,
            "status": "active",
            "current_period_start": datetime.now(),
            "current_period_end": datetime.now() + timedelta(days=30),
            "amount": 1900 if tier == "PRO" else 9900,
            "currency": "USD",
            "created_at": datetime.now()
        })
    return subscriptions

def generate_test_licenses(count: int, tier: str = "PRO") -> List[Dict[str, Any]]:
    """Generate test licenses for performance testing."""
    licenses = []
    for i in range(count):
        licenses.append({
            "id": f"lic_test_{i:06d}",
            "license_key": f"FB-{tier[:3].upper()}-{i:08d}-{i:08d}",
            "tier": tier,
            "user_id": f"user_test_{i:06d}",
            "subscription_id": f"sub_test_{i:06d}",
            "expires_at": datetime.now() + timedelta(days=30),
            "is_active": True,
            "created_at": datetime.now()
        })
    return licenses

def generate_webhook_events(count: int, event_type: str = "subscription.created") -> List[Dict[str, Any]]:
    """Generate test webhook events for performance testing."""
    events = []
    for i in range(count):
        events.append({
            "id": f"evt_test_{i:06d}",
            "type": event_type,
            "data": {
                "object": {
                    "id": f"dodo_sub_test_{i:06d}",
                    "customer_id": f"dodo_cust_test_{i:06d}",
                    "customer_email": f"test{i:06d}@example.com",
                    "product_id": "prod_pro_monthly",
                    "status": "active",
                    "current_period_start": int(datetime.now().timestamp()),
                    "current_period_end": int((datetime.now() + timedelta(days=30)).timestamp()),
                    "amount": 1900,
                    "currency": "USD"
                }
            },
            "created": int(datetime.now().timestamp()),
            "livemode": False
        })
    return events
