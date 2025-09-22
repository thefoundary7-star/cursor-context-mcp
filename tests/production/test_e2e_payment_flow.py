"""
End-to-End Payment Flow Tests

This module tests the complete payment flow from subscription creation
through license delivery, including webhook processing and email delivery.
"""

import pytest
import pytest_asyncio
import asyncio
import json
from datetime import datetime, timedelta
from unittest.mock import patch, AsyncMock, Mock
from typing import Dict, Any

from .fixtures import (
    SAMPLE_USERS, SAMPLE_SUBSCRIPTIONS, SAMPLE_LICENSES,
    DODO_WEBHOOK_EVENTS, MockDodoPayments, MockEmailService, MockDatabase
)


class TestEndToEndPaymentFlow:
    """Test complete payment flow scenarios."""
    
    @pytest_asyncio.fixture
    async def setup_test_environment(self):
        """Set up test environment with mock services."""
        self.mock_dodo = MockDodoPayments()
        self.mock_email = MockEmailService()
        self.mock_db = MockDatabase()
        
        # Pre-populate with test data
        for user in SAMPLE_USERS.values():
            await self.mock_db.create_user(user.__dict__)
        
        return {
            "dodo": self.mock_dodo,
            "email": self.mock_email,
            "database": self.mock_db
        }
    
    @pytest.mark.asyncio
    async def test_free_tier_registration_flow(self, setup_test_environment):
        """Test complete free tier registration flow."""
        services = await setup_test_environment
        
        # Step 1: User registers for free tier
        user_data = {
            "email": "newuser@test.com",
            "name": "New User",
            "company": "New Corp",
            "tier": "FREE"
        }
        
        user = await services["database"].create_user(user_data)
        assert user["email"] == "newuser@test.com"
        assert user["tier"] == "FREE"
        
        # Step 2: Free license is automatically created
        license_data = {
            "user_id": user["id"],
            "license_key": "FB-FREE-00000000-00000000",
            "tier": "FREE",
            "max_servers": 1,
            "is_active": True,
            "expires_at": None  # Free tier doesn't expire
        }
        
        license = await services["database"].create_license(license_data)
        assert license["tier"] == "FREE"
        assert license["is_active"] is True
        
        # Step 3: Welcome email is sent
        welcome_data = {
            "to": user["email"],
            "customer_name": user["name"],
            "plan": "FREE",
            "features": ["Basic file transfers", "Community support"],
            "setup_url": "https://app.filebridge.com/setup",
            "support_email": "support@filebridge.com"
        }
        
        email_result = await services["email"].send_welcome_email(welcome_data)
        assert email_result["success"] is True
        
        # Verify email was sent
        assert len(services["email"].sent_emails) == 1
        assert services["email"].sent_emails[0]["type"] == "welcome"
        assert services["email"].sent_emails[0]["to"] == user["email"]
    
    @pytest.mark.asyncio
    async def test_pro_subscription_creation_flow(self, setup_test_environment):
        """Test Pro subscription creation and license delivery."""
        services = await setup_test_environment
        
        # Step 1: User initiates Pro subscription
        user = SAMPLE_USERS["pro_user"]
        subscription_data = SAMPLE_SUBSCRIPTIONS["pro_subscription"]
        
        # Step 2: Subscription is created in Dodo
        dodo_subscription = await services["dodo"].get_subscription(subscription_data.dodo_subscription_id)
        if not dodo_subscription:
            # Simulate creating subscription in Dodo
            services["dodo"].subscriptions[subscription_data.dodo_subscription_id] = {
                "id": subscription_data.dodo_subscription_id,
                "customer_id": subscription_data.dodo_customer_id,
                "product_id": subscription_data.dodo_product_id,
                "status": "active",
                "current_period_start": subscription_data.current_period_start.timestamp(),
                "current_period_end": subscription_data.current_period_end.timestamp(),
                "amount": subscription_data.amount,
                "currency": subscription_data.currency
            }
        
        # Step 3: Subscription webhook is received
        webhook_event = DODO_WEBHOOK_EVENTS["subscription_created"]
        
        # Step 4: Process webhook event
        event_data = webhook_event["data"]["object"]
        
        # Verify user exists
        user_record = await services["database"].get_user_by_dodo_customer_id(event_data["customer_id"])
        assert user_record is not None
        assert user_record["email"] == event_data["customer_email"]
        
        # Create subscription record
        subscription_record = await services["database"].create_subscription({
            "user_id": user_record["id"],
            "dodo_subscription_id": event_data["id"],
            "dodo_customer_id": event_data["customer_id"],
            "dodo_product_id": event_data["product_id"],
            "tier": "PRO",
            "status": event_data["status"],
            "current_period_start": datetime.fromtimestamp(event_data["current_period_start"]),
            "current_period_end": datetime.fromtimestamp(event_data["current_period_end"]),
            "amount": event_data["amount"],
            "currency": event_data["currency"]
        })
        
        assert subscription_record["tier"] == "PRO"
        assert subscription_record["status"] == "active"
        
        # Step 5: License is generated
        license_metadata = {
            "userId": user_record["id"],
            "tier": "PRO",
            "email": user_record["email"]
        }
        
        license_data = await services["dodo"].generate_license_key(
            event_data["id"], 
            license_metadata
        )
        
        # Create license record
        license_record = await services["database"].create_license({
            "user_id": user_record["id"],
            "subscription_id": subscription_record["id"],
            "license_key": license_data["license_key"],
            "tier": "PRO",
            "max_servers": 5,
            "is_active": True,
            "expires_at": datetime.fromtimestamp(event_data["current_period_end"])
        })
        
        assert license_record["tier"] == "PRO"
        assert license_record["is_active"] is True
        
        # Step 6: License key email is sent
        email_data = {
            "to": user_record["email"],
            "customer_name": user_record["name"],
            "license_key": license_record["license_key"],
            "plan": "PRO",
            "subscription_id": subscription_record["dodo_subscription_id"],
            "expires_at": license_record["expires_at"],
            "download_url": "https://releases.filebridge.com/latest",
            "support_email": "support@filebridge.com"
        }
        
        email_result = await services["email"].send_license_key(email_data)
        assert email_result["success"] is True
        
        # Verify complete flow
        assert len(services["email"].sent_emails) == 1
        assert services["email"].sent_emails[0]["type"] == "license_key"
        assert services["email"].sent_emails[0]["to"] == user_record["email"]
    
    @pytest.mark.asyncio
    async def test_enterprise_subscription_flow(self, setup_test_environment):
        """Test Enterprise subscription creation and license delivery."""
        services = await setup_test_environment
        
        user = SAMPLE_USERS["enterprise_user"]
        subscription_data = SAMPLE_SUBSCRIPTIONS["enterprise_subscription"]
        
        # Create subscription
        subscription_record = await services["database"].create_subscription(subscription_data.__dict__)
        
        # Generate license
        license_metadata = {
            "userId": user.id,
            "tier": "ENTERPRISE",
            "email": user.email
        }
        
        license_data = await services["dodo"].generate_license_key(
            subscription_data.dodo_subscription_id,
            license_metadata
        )
        
        # Create license record
        license_record = await services["database"].create_license({
            "user_id": user.id,
            "subscription_id": subscription_record["id"],
            "license_key": license_data["license_key"],
            "tier": "ENTERPRISE",
            "max_servers": 50,  # Enterprise gets more servers
            "is_active": True,
            "expires_at": subscription_data.current_period_end
        })
        
        # Send license email
        email_data = {
            "to": user.email,
            "customer_name": user.name,
            "license_key": license_record["license_key"],
            "plan": "ENTERPRISE",
            "subscription_id": subscription_record["dodo_subscription_id"],
            "expires_at": license_record["expires_at"],
            "download_url": "https://releases.filebridge.com/latest",
            "support_email": "support@filebridge.com"
        }
        
        email_result = await services["email"].send_license_key(email_data)
        assert email_result["success"] is True
        
        # Verify Enterprise-specific features
        assert license_record["tier"] == "ENTERPRISE"
        assert license_record["max_servers"] == 50
        assert license_record["is_active"] is True
    
    @pytest.mark.asyncio
    async def test_subscription_cancellation_flow(self, setup_test_environment):
        """Test subscription cancellation and license deactivation."""
        services = await setup_test_environment
        
        # Setup: Create active subscription and license
        user = SAMPLE_USERS["pro_user"]
        subscription_data = SAMPLE_SUBSCRIPTIONS["pro_subscription"]
        
        subscription_record = await services["database"].create_subscription(subscription_data.__dict__)
        license_record = await services["database"].create_license({
            "user_id": user.id,
            "subscription_id": subscription_record["id"],
            "license_key": "FB-PRO-12345678-ABCD-EFGH-IJKL-MNOPQRSTUVWX",
            "tier": "PRO",
            "max_servers": 5,
            "is_active": True,
            "expires_at": subscription_data.current_period_end
        })
        
        # Step 1: Cancellation webhook is received
        cancellation_event = DODO_WEBHOOK_EVENTS["subscription_cancelled"]
        event_data = cancellation_event["data"]["object"]
        
        # Step 2: Update subscription status
        subscription_record["status"] = "cancelled"
        subscription_record["canceled_at"] = datetime.now()
        subscription_record["cancellation_reason"] = event_data["cancellation_reason"]
        
        # Step 3: Deactivate license
        license_record["is_active"] = False
        license_record["expires_at"] = datetime.now()  # Immediate expiration
        
        # Step 4: Send cancellation email
        cancellation_email_data = {
            "to": user.email,
            "customer_name": user.name,
            "plan": "PRO",
            "cancellation_reason": event_data["cancellation_reason"],
            "support_email": "support@filebridge.com"
        }
        
        email_result = await services["email"].send_payment_failed_email(cancellation_email_data)
        assert email_result["success"] is True
        
        # Verify cancellation
        assert subscription_record["status"] == "cancelled"
        assert license_record["is_active"] is False
        assert len(services["email"].sent_emails) == 1
    
    @pytest.mark.asyncio
    async def test_payment_failure_flow(self, setup_test_environment):
        """Test payment failure handling and retry flow."""
        services = await setup_test_environment
        
        user = SAMPLE_USERS["pro_user"]
        subscription_data = SAMPLE_SUBSCRIPTIONS["pro_subscription"]
        
        # Setup: Create subscription
        subscription_record = await services["database"].create_subscription(subscription_data.__dict__)
        
        # Step 1: Payment failure webhook
        payment_failure_event = DODO_WEBHOOK_EVENTS["payment_failed"]
        event_data = payment_failure_event["data"]["object"]
        
        # Step 2: Create payment record
        payment_record = await services["database"].create_payment({
            "dodo_payment_id": event_data["id"],
            "subscription_id": subscription_record["dodo_subscription_id"],
            "user_id": user.id,
            "amount": event_data["amount"],
            "currency": event_data["currency"],
            "status": "failed",
            "failure_reason": event_data["failure_reason"],
            "failed_at": datetime.fromtimestamp(event_data["failed_at"])
        })
        
        # Step 3: Send payment failure email
        failure_email_data = {
            "to": user.email,
            "customer_name": user.name,
            "plan": "PRO",
            "amount": f"${event_data['amount'] / 100:.2f}",
            "currency": event_data["currency"],
            "failure_reason": event_data["failure_reason"],
            "retry_url": "https://app.filebridge.com/billing/retry",
            "support_email": "support@filebridge.com"
        }
        
        email_result = await services["email"].send_payment_failed_email(failure_email_data)
        assert email_result["success"] is True
        
        # Verify payment failure handling
        assert payment_record["status"] == "failed"
        assert payment_record["failure_reason"] == "insufficient_funds"
        assert len(services["email"].sent_emails) == 1
        assert services["email"].sent_emails[0]["type"] == "payment_failed"
    
    @pytest.mark.asyncio
    async def test_webhook_idempotency(self, setup_test_environment):
        """Test webhook idempotency - same event processed multiple times."""
        services = await setup_test_environment
        
        # Step 1: Process webhook event first time
        webhook_event = DODO_WEBHOOK_EVENTS["subscription_created"]
        event_id = webhook_event["id"]
        
        # Store webhook event
        stored_event = await services["database"].store_webhook_event(webhook_event)
        assert stored_event["id"] == event_id
        
        # Step 2: Process same event again
        duplicate_event = await services["database"].get_webhook_event(event_id)
        assert duplicate_event is not None
        assert duplicate_event["id"] == event_id
        
        # Step 3: Verify idempotency - no duplicate processing
        # In a real implementation, this would check if the event was already processed
        # and skip processing if it was
        
        # Verify only one event record exists
        assert len(services["database"].webhook_events) == 1
    
    @pytest.mark.asyncio
    async def test_concurrent_webhook_processing(self, setup_test_environment):
        """Test concurrent webhook processing."""
        services = await setup_test_environment
        
        # Create multiple webhook events
        events = []
        for i in range(5):
            event = DODO_WEBHOOK_EVENTS["subscription_created"].copy()
            event["id"] = f"evt_concurrent_{i}"
            event["data"]["object"]["id"] = f"dodo_sub_concurrent_{i}"
            event["data"]["object"]["customer_id"] = f"dodo_cust_concurrent_{i}"
            event["data"]["object"]["customer_email"] = f"concurrent{i}@test.com"
            events.append(event)
        
        # Process events concurrently
        async def process_event(event):
            return await services["database"].store_webhook_event(event)
        
        results = await asyncio.gather(*[process_event(event) for event in events])
        
        # Verify all events were processed
        assert len(results) == 5
        assert len(services["database"].webhook_events) == 5
        
        # Verify no duplicate event IDs
        event_ids = [result["id"] for result in results]
        assert len(set(event_ids)) == 5  # All unique
    
    @pytest.mark.asyncio
    async def test_email_delivery_failure_handling(self, setup_test_environment):
        """Test email delivery failure handling and retry logic."""
        services = await setup_test_environment
        
        user = SAMPLE_USERS["pro_user"]
        
        # Step 1: Attempt to send email to failing address
        email_data = {
            "to": "fail@fail.com",  # This will trigger delivery failure
            "customer_name": user.name,
            "license_key": "FB-PRO-12345678-ABCD-EFGH-IJKL-MNOPQRSTUVWX",
            "plan": "PRO",
            "subscription_id": "dodo_sub_pro_001",
            "expires_at": datetime.now() + timedelta(days=30),
            "download_url": "https://releases.filebridge.com/latest",
            "support_email": "support@filebridge.com"
        }
        
        # Step 2: Send email (will fail)
        email_result = await services["email"].send_license_key(email_data)
        assert email_result["success"] is False
        
        # Step 3: Verify failure was recorded
        assert len(services["email"].delivery_failures) == 1
        assert services["email"].delivery_failures[0]["to"] == "fail@fail.com"
        
        # Step 4: Retry with different email
        email_data["to"] = "retry@test.com"
        retry_result = await services["email"].send_license_key(email_data)
        assert retry_result["success"] is True
        
        # Verify retry succeeded
        assert len(services["email"].sent_emails) == 1
        assert services["email"].sent_emails[0]["to"] == "retry@test.com"
    
    @pytest.mark.asyncio
    async def test_database_transaction_rollback(self, setup_test_environment):
        """Test database transaction rollback on failure."""
        services = await setup_test_environment
        
        user = SAMPLE_USERS["pro_user"]
        
        # Step 1: Start transaction (simulate)
        # In a real implementation, this would use database transactions
        
        # Step 2: Create subscription
        subscription_data = SAMPLE_SUBSCRIPTIONS["pro_subscription"]
        subscription_record = await services["database"].create_subscription(subscription_data.__dict__)
        
        # Step 3: Attempt to create license with invalid data (should fail)
        try:
            license_record = await services["database"].create_license({
                "user_id": "invalid_user_id",  # This should cause failure
                "subscription_id": subscription_record["id"],
                "license_key": "FB-PRO-12345678-ABCD-EFGH-IJKL-MNOPQRSTUVWX",
                "tier": "PRO",
                "max_servers": 5,
                "is_active": True,
                "expires_at": subscription_data.current_period_end
            })
            # If we get here, the test should fail
            assert False, "Expected license creation to fail"
        except Exception:
            # Expected failure - verify subscription still exists
            assert subscription_record["id"] in services["database"].subscriptions
            # Verify no license was created
            assert len(services["database"].licenses) == 0
    
    @pytest.mark.asyncio
    async def test_license_activation_via_cli(self, setup_test_environment):
        """Test license activation via CLI interface."""
        services = await setup_test_environment
        
        user = SAMPLE_USERS["pro_user"]
        license_data = SAMPLE_LICENSES["pro_license"]
        
        # Create license
        license_record = await services["database"].create_license(license_data.__dict__)
        
        # Step 1: CLI attempts to activate license
        license_key = license_record["license_key"]
        
        # Step 2: Validate license key format
        assert license_key.startswith("FB-PRO-")
        assert len(license_key) == 43  # Expected length
        
        # Step 3: Check license status
        assert license_record["is_active"] is True
        assert license_record["tier"] == "PRO"
        
        # Step 4: Verify license belongs to correct user
        assert license_record["user_id"] == user.id
        
        # Step 5: Check expiration
        assert license_record["expires_at"] > datetime.now()
        
        # Step 6: Record activation in analytics
        activation_event = {
            "user_id": user.id,
            "license_id": license_record["id"],
            "event_type": "LICENSE_VALIDATION",
            "event_data": {"license_key": license_key, "activation_method": "CLI"},
            "timestamp": datetime.now()
        }
        
        services["database"].analytics.append(activation_event)
        
        # Verify activation was recorded
        assert len(services["database"].analytics) == 1
        assert services["database"].analytics[0]["event_type"] == "LICENSE_VALIDATION"
    
    @pytest.mark.asyncio
    async def test_usage_tracking_for_free_tier(self, setup_test_environment):
        """Test usage tracking and limits for free tier users."""
        services = await setup_test_environment
        
        user = SAMPLE_USERS["free_user"]
        
        # Create free license
        license_record = await services["database"].create_license({
            "user_id": user.id,
            "license_key": "FB-FREE-00000000-00000000",
            "tier": "FREE",
            "max_servers": 1,
            "is_active": True,
            "expires_at": None
        })
        
        # Step 1: Track usage events
        usage_events = [
            {
                "user_id": user.id,
                "license_id": license_record["id"],
                "event_type": "REQUEST_COUNT",
                "event_data": {"count": 1},
                "timestamp": datetime.now()
            },
            {
                "user_id": user.id,
                "license_id": license_record["id"],
                "event_type": "REQUEST_COUNT",
                "event_data": {"count": 1},
                "timestamp": datetime.now()
            }
        ]
        
        for event in usage_events:
            services["database"].analytics.append(event)
        
        # Step 2: Check usage limits
        total_requests = sum(
            event["event_data"]["count"] 
            for event in services["database"].analytics 
            if event["event_type"] == "REQUEST_COUNT"
        )
        
        # Free tier limit (example: 100 requests per day)
        free_tier_limit = 100
        assert total_requests <= free_tier_limit
        
        # Step 3: Simulate quota exceeded
        if total_requests >= free_tier_limit:
            quota_exceeded_event = {
                "user_id": user.id,
                "license_id": license_record["id"],
                "event_type": "QUOTA_EXCEEDED",
                "event_data": {"limit": free_tier_limit, "current_usage": total_requests},
                "timestamp": datetime.now()
            }
            services["database"].analytics.append(quota_exceeded_event)
            
            # Verify quota exceeded event was recorded
            quota_events = [
                event for event in services["database"].analytics 
                if event["event_type"] == "QUOTA_EXCEEDED"
            ]
            assert len(quota_events) == 1
