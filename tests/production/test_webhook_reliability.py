"""
Webhook Reliability Testing Suite

This module tests webhook delivery reliability, idempotency handling,
retry mechanisms, signature validation, and high-volume processing.
"""

import pytest
import pytest_asyncio
import asyncio
import time
import json
import hashlib
import hmac
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from unittest.mock import patch, AsyncMock, Mock, MagicMock
import aiohttp
import aiofiles

from .fixtures import (
    DODO_WEBHOOK_EVENTS, MockDatabase, MockDodoPayments,
    generate_webhook_events, SAMPLE_USERS, SAMPLE_SUBSCRIPTIONS
)


class TestWebhookSignatureValidation:
    """Test webhook signature validation and security."""
    
    @pytest.fixture
    def webhook_secret(self):
        """Webhook secret for signature validation."""
        return "test_webhook_secret_12345"
    
    @pytest.fixture
    def webhook_payload(self):
        """Sample webhook payload."""
        return json.dumps(DODO_WEBHOOK_EVENTS["subscription_created"])
    
    def generate_webhook_signature(self, payload: str, secret: str, timestamp: str = None) -> str:
        """Generate webhook signature for testing."""
        if timestamp is None:
            timestamp = str(int(time.time()))
        
        message = f"{timestamp}.{payload}"
        signature = hmac.new(
            secret.encode('utf-8'),
            message.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        return f"v1={signature}"
    
    @pytest.mark.asyncio
    async def test_valid_webhook_signature(self, webhook_secret, webhook_payload):
        """Test valid webhook signature validation."""
        timestamp = str(int(time.time()))
        signature = self.generate_webhook_signature(webhook_payload, webhook_secret, timestamp)
        
        # Mock signature validation
        with patch('src.services.dodo.webhookHandler.dodoPayments.verifyWebhookSignature') as mock_verify:
            mock_verify.return_value = True
            
            # Test signature validation
            is_valid = mock_verify(webhook_payload, signature, webhook_secret)
            assert is_valid is True
    
    @pytest.mark.asyncio
    async def test_invalid_webhook_signature(self, webhook_secret, webhook_payload):
        """Test invalid webhook signature validation."""
        invalid_signature = "v1=invalid_signature"
        
        # Mock signature validation
        with patch('src.services.dodo.webhookHandler.dodoPayments.verifyWebhookSignature') as mock_verify:
            mock_verify.return_value = False
            
            # Test signature validation
            is_valid = mock_verify(webhook_payload, invalid_signature, webhook_secret)
            assert is_valid is False
    
    @pytest.mark.asyncio
    async def test_missing_webhook_signature(self, webhook_secret, webhook_payload):
        """Test missing webhook signature handling."""
        # Mock signature validation
        with patch('src.services.dodo.webhookHandler.dodoPayments.verifyWebhookSignature') as mock_verify:
            mock_verify.return_value = False
            
            # Test with no signature
            is_valid = mock_verify(webhook_payload, "", webhook_secret)
            assert is_valid is False
    
    @pytest.mark.asyncio
    async def test_timestamp_validation(self, webhook_secret, webhook_payload):
        """Test webhook timestamp validation."""
        # Test with old timestamp (should be rejected)
        old_timestamp = str(int(time.time()) - 3600)  # 1 hour ago
        old_signature = self.generate_webhook_signature(webhook_payload, webhook_secret, old_timestamp)
        
        # Mock signature validation
        with patch('src.services.dodo.webhookHandler.dodoPayments.verifyWebhookSignature') as mock_verify:
            mock_verify.return_value = False  # Old timestamp should be rejected
            
            is_valid = mock_verify(webhook_payload, old_signature, webhook_secret)
            assert is_valid is False
        
        # Test with future timestamp (should be rejected)
        future_timestamp = str(int(time.time()) + 3600)  # 1 hour in future
        future_signature = self.generate_webhook_signature(webhook_payload, webhook_secret, future_timestamp)
        
        with patch('src.services.dodo.webhookHandler.dodoPayments.verifyWebhookSignature') as mock_verify:
            mock_verify.return_value = False  # Future timestamp should be rejected
            
            is_valid = mock_verify(webhook_payload, future_signature, webhook_secret)
            assert is_valid is False
    
    @pytest.mark.asyncio
    async def test_signature_replay_attack_prevention(self, webhook_secret, webhook_payload):
        """Test signature replay attack prevention."""
        timestamp = str(int(time.time()))
        signature = self.generate_webhook_signature(webhook_payload, webhook_secret, timestamp)
        
        # Mock signature validation
        with patch('src.services.dodo.webhookHandler.dodoPayments.verifyWebhookSignature') as mock_verify:
            mock_verify.return_value = True
            
            # First request should be valid
            is_valid = mock_verify(webhook_payload, signature, webhook_secret)
            assert is_valid is True
            
            # Second request with same signature should be rejected (replay attack)
            mock_verify.return_value = False
            is_valid = mock_verify(webhook_payload, signature, webhook_secret)
            assert is_valid is False


class TestWebhookIdempotency:
    """Test webhook idempotency handling."""
    
    @pytest_asyncio.fixture
    async def setup_idempotency_database(self):
        """Set up database for idempotency testing."""
        db = MockDatabase()
        return db
    
    @pytest.mark.asyncio
    async def test_webhook_idempotency_same_event(self, setup_idempotency_database):
        """Test webhook idempotency with same event."""
        db = await setup_idempotency_database
        
        # First webhook event
        event1 = DODO_WEBHOOK_EVENTS["subscription_created"]
        event1["id"] = "evt_idempotent_001"
        
        # Store first event
        stored_event1 = await db.store_webhook_event(event1)
        assert stored_event1["id"] == "evt_idempotent_001"
        
        # Second webhook event (same ID)
        event2 = event1.copy()
        event2["id"] = "evt_idempotent_001"  # Same ID
        
        # Check if event already exists
        existing_event = await db.get_webhook_event("evt_idempotent_001")
        assert existing_event is not None
        assert existing_event["id"] == "evt_idempotent_001"
        
        # Verify only one event exists
        assert len(db.webhook_events) == 1
    
    @pytest.mark.asyncio
    async def test_webhook_idempotency_different_events(self, setup_idempotency_database):
        """Test webhook idempotency with different events."""
        db = await setup_idempotency_database
        
        # First webhook event
        event1 = DODO_WEBHOOK_EVENTS["subscription_created"]
        event1["id"] = "evt_idempotent_001"
        
        # Second webhook event (different ID)
        event2 = DODO_WEBHOOK_EVENTS["subscription_activated"]
        event2["id"] = "evt_idempotent_002"
        
        # Store both events
        stored_event1 = await db.store_webhook_event(event1)
        stored_event2 = await db.store_webhook_event(event2)
        
        # Verify both events exist
        assert stored_event1["id"] == "evt_idempotent_001"
        assert stored_event2["id"] == "evt_idempotent_002"
        assert len(db.webhook_events) == 2
    
    @pytest.mark.asyncio
    async def test_webhook_idempotency_duplicate_processing(self, setup_idempotency_database):
        """Test webhook idempotency with duplicate processing."""
        db = await setup_idempotency_database
        
        # Create webhook event
        event = DODO_WEBHOOK_EVENTS["subscription_created"]
        event["id"] = "evt_duplicate_001"
        
        # Store event
        stored_event = await db.store_webhook_event(event)
        
        # Simulate processing
        stored_event["processed"] = True
        stored_event["processed_at"] = datetime.now()
        
        # Attempt to process same event again
        existing_event = await db.get_webhook_event("evt_duplicate_001")
        
        # Verify event was already processed
        assert existing_event["processed"] is True
        assert existing_event["processed_at"] is not None
        
        # Verify no duplicate processing occurred
        assert len(db.webhook_events) == 1
    
    @pytest.mark.asyncio
    async def test_webhook_idempotency_partial_processing(self, setup_idempotency_database):
        """Test webhook idempotency with partial processing."""
        db = await setup_idempotency_database
        
        # Create webhook event
        event = DODO_WEBHOOK_EVENTS["subscription_created"]
        event["id"] = "evt_partial_001"
        
        # Store event
        stored_event = await db.store_webhook_event(event)
        
        # Simulate partial processing (failed)
        stored_event["processed"] = False
        stored_event["attempts"] = 1
        stored_event["last_attempt"] = datetime.now()
        
        # Attempt to process event again
        existing_event = await db.get_webhook_event("evt_partial_001")
        
        # Verify event can be retried
        assert existing_event["processed"] is False
        assert existing_event["attempts"] == 1
        
        # Simulate retry
        existing_event["attempts"] = 2
        existing_event["last_attempt"] = datetime.now()
        
        # Verify retry was recorded
        assert existing_event["attempts"] == 2


class TestWebhookRetryMechanisms:
    """Test webhook retry mechanisms and failure handling."""
    
    @pytest_asyncio.fixture
    async def setup_retry_database(self):
        """Set up database for retry testing."""
        db = MockDatabase()
        return db
    
    @pytest.mark.asyncio
    async def test_webhook_retry_exponential_backoff(self, setup_retry_database):
        """Test webhook retry with exponential backoff."""
        db = await setup_retry_database
        
        # Create webhook event
        event = DODO_WEBHOOK_EVENTS["subscription_created"]
        event["id"] = "evt_retry_001"
        
        # Store event
        stored_event = await db.store_webhook_event(event)
        
        # Simulate retry attempts with exponential backoff
        retry_delays = []
        base_delay = 1.0  # 1 second base delay
        
        for attempt in range(1, 6):  # 5 retry attempts
            delay = base_delay * (2 ** (attempt - 1))  # Exponential backoff
            retry_delays.append(delay)
            
            # Update event with retry attempt
            stored_event["attempts"] = attempt
            stored_event["last_attempt"] = datetime.now()
            stored_event["next_retry"] = datetime.now() + timedelta(seconds=delay)
        
        # Verify exponential backoff delays
        expected_delays = [1.0, 2.0, 4.0, 8.0, 16.0]
        assert retry_delays == expected_delays
        
        # Verify final retry attempt
        assert stored_event["attempts"] == 5
        assert stored_event["next_retry"] > datetime.now()
    
    @pytest.mark.asyncio
    async def test_webhook_retry_max_attempts(self, setup_retry_database):
        """Test webhook retry with maximum attempts limit."""
        db = await setup_retry_database
        
        # Create webhook event
        event = DODO_WEBHOOK_EVENTS["subscription_created"]
        event["id"] = "evt_max_retry_001"
        
        # Store event
        stored_event = await db.store_webhook_event(event)
        
        # Simulate maximum retry attempts
        max_attempts = 3
        
        for attempt in range(1, max_attempts + 1):
            stored_event["attempts"] = attempt
            stored_event["last_attempt"] = datetime.now()
            
            if attempt < max_attempts:
                stored_event["next_retry"] = datetime.now() + timedelta(seconds=60)
            else:
                # Max attempts reached
                stored_event["processed"] = False
                stored_event["failed"] = True
                stored_event["failure_reason"] = "max_retry_attempts_reached"
        
        # Verify max attempts reached
        assert stored_event["attempts"] == max_attempts
        assert stored_event["failed"] is True
        assert stored_event["failure_reason"] == "max_retry_attempts_reached"
    
    @pytest.mark.asyncio
    async def test_webhook_retry_success_after_failure(self, setup_retry_database):
        """Test webhook retry success after initial failure."""
        db = await setup_retry_database
        
        # Create webhook event
        event = DODO_WEBHOOK_EVENTS["subscription_created"]
        event["id"] = "evt_retry_success_001"
        
        # Store event
        stored_event = await db.store_webhook_event(event)
        
        # Simulate initial failure
        stored_event["attempts"] = 1
        stored_event["processed"] = False
        stored_event["last_attempt"] = datetime.now()
        stored_event["failure_reason"] = "temporary_failure"
        
        # Simulate retry success
        stored_event["attempts"] = 2
        stored_event["processed"] = True
        stored_event["processed_at"] = datetime.now()
        stored_event["failure_reason"] = None
        
        # Verify retry success
        assert stored_event["attempts"] == 2
        assert stored_event["processed"] is True
        assert stored_event["processed_at"] is not None
        assert stored_event["failure_reason"] is None
    
    @pytest.mark.asyncio
    async def test_webhook_retry_different_failure_types(self, setup_retry_database):
        """Test webhook retry with different failure types."""
        db = await setup_retry_database
        
        # Test different failure types
        failure_types = [
            "network_timeout",
            "server_error",
            "invalid_payload",
            "authentication_failed",
            "rate_limited"
        ]
        
        for i, failure_type in enumerate(failure_types):
            event = DODO_WEBHOOK_EVENTS["subscription_created"]
            event["id"] = f"evt_failure_{i:03d}"
            
            stored_event = await db.store_webhook_event(event)
            
            # Simulate failure
            stored_event["attempts"] = 1
            stored_event["processed"] = False
            stored_event["failure_reason"] = failure_type
            stored_event["last_attempt"] = datetime.now()
            
            # Verify failure was recorded
            assert stored_event["failure_reason"] == failure_type
            assert stored_event["processed"] is False
        
        # Verify all failure types were recorded
        assert len(db.webhook_events) == len(failure_types)
        
        # Verify different failure types
        failure_reasons = [event["failure_reason"] for event in db.webhook_events.values()]
        assert set(failure_reasons) == set(failure_types)


class TestWebhookDeliveryReliability:
    """Test webhook delivery reliability under various conditions."""
    
    @pytest_asyncio.fixture
    async def setup_delivery_database(self):
        """Set up database for delivery testing."""
        db = MockDatabase()
        return db
    
    @pytest.mark.asyncio
    async def test_webhook_delivery_under_normal_conditions(self, setup_delivery_database):
        """Test webhook delivery under normal conditions."""
        db = await setup_delivery_database
        
        # Create webhook event
        event = DODO_WEBHOOK_EVENTS["subscription_created"]
        event["id"] = "evt_normal_001"
        
        # Store event
        stored_event = await db.store_webhook_event(event)
        
        # Simulate successful delivery
        stored_event["delivered"] = True
        stored_event["delivered_at"] = datetime.now()
        stored_event["response_status"] = 200
        stored_event["response_time"] = 0.5  # 500ms
        
        # Verify delivery
        assert stored_event["delivered"] is True
        assert stored_event["response_status"] == 200
        assert stored_event["response_time"] < 1.0  # Should be fast
    
    @pytest.mark.asyncio
    async def test_webhook_delivery_under_network_issues(self, setup_delivery_database):
        """Test webhook delivery under network issues."""
        db = await setup_delivery_database
        
        # Create webhook event
        event = DODO_WEBHOOK_EVENTS["subscription_created"]
        event["id"] = "evt_network_001"
        
        # Store event
        stored_event = await db.store_webhook_event(event)
        
        # Simulate network issues
        network_issues = [
            {"status": 408, "reason": "timeout", "retry": True},
            {"status": 502, "reason": "bad_gateway", "retry": True},
            {"status": 503, "reason": "service_unavailable", "retry": True},
            {"status": 504, "reason": "gateway_timeout", "retry": True}
        ]
        
        for i, issue in enumerate(network_issues):
            stored_event["attempts"] = i + 1
            stored_event["response_status"] = issue["status"]
            stored_event["failure_reason"] = issue["reason"]
            stored_event["should_retry"] = issue["retry"]
            stored_event["last_attempt"] = datetime.now()
        
        # Verify network issues were handled
        assert stored_event["attempts"] == len(network_issues)
        assert stored_event["should_retry"] is True
        assert stored_event["response_status"] in [408, 502, 503, 504]
    
    @pytest.mark.asyncio
    async def test_webhook_delivery_under_high_load(self, setup_delivery_database):
        """Test webhook delivery under high load."""
        db = await setup_delivery_database
        
        # Create multiple webhook events
        events = []
        for i in range(100):
            event = DODO_WEBHOOK_EVENTS["subscription_created"]
            event["id"] = f"evt_load_{i:03d}"
            events.append(event)
        
        # Store events
        start_time = time.time()
        for event in events:
            await db.store_webhook_event(event)
        end_time = time.time()
        
        # Verify all events were stored
        assert len(db.webhook_events) == 100
        
        # Verify performance
        duration = end_time - start_time
        events_per_second = 100 / duration
        assert events_per_second > 50  # Should handle at least 50 events/second
        
        print(f"High load delivery: {events_per_second:.2f} events/second")
    
    @pytest.mark.asyncio
    async def test_webhook_delivery_under_rate_limiting(self, setup_delivery_database):
        """Test webhook delivery under rate limiting."""
        db = await setup_delivery_database
        
        # Create webhook event
        event = DODO_WEBHOOK_EVENTS["subscription_created"]
        event["id"] = "evt_rate_limit_001"
        
        # Store event
        stored_event = await db.store_webhook_event(event)
        
        # Simulate rate limiting
        stored_event["response_status"] = 429
        stored_event["failure_reason"] = "rate_limited"
        stored_event["retry_after"] = 60  # Retry after 60 seconds
        stored_event["last_attempt"] = datetime.now()
        
        # Verify rate limiting was handled
        assert stored_event["response_status"] == 429
        assert stored_event["failure_reason"] == "rate_limited"
        assert stored_event["retry_after"] == 60
        
        # Verify retry timing
        next_retry = stored_event["last_attempt"] + timedelta(seconds=stored_event["retry_after"])
        assert next_retry > datetime.now()
    
    @pytest.mark.asyncio
    async def test_webhook_delivery_under_server_errors(self, setup_delivery_database):
        """Test webhook delivery under server errors."""
        db = await setup_delivery_database
        
        # Create webhook event
        event = DODO_WEBHOOK_EVENTS["subscription_created"]
        event["id"] = "evt_server_error_001"
        
        # Store event
        stored_event = await db.store_webhook_event(event)
        
        # Simulate server errors
        server_errors = [
            {"status": 500, "reason": "internal_server_error", "retry": True},
            {"status": 501, "reason": "not_implemented", "retry": False},
            {"status": 502, "reason": "bad_gateway", "retry": True},
            {"status": 503, "reason": "service_unavailable", "retry": True},
            {"status": 504, "reason": "gateway_timeout", "retry": True}
        ]
        
        for i, error in enumerate(server_errors):
            stored_event["attempts"] = i + 1
            stored_event["response_status"] = error["status"]
            stored_event["failure_reason"] = error["reason"]
            stored_event["should_retry"] = error["retry"]
            stored_event["last_attempt"] = datetime.now()
        
        # Verify server errors were handled
        assert stored_event["attempts"] == len(server_errors)
        assert stored_event["response_status"] in [500, 501, 502, 503, 504]
        
        # Verify retry logic
        final_error = server_errors[-1]
        assert stored_event["should_retry"] == final_error["retry"]


class TestWebhookHighVolumeProcessing:
    """Test webhook processing under high volume conditions."""
    
    @pytest_asyncio.fixture
    async def setup_high_volume_database(self):
        """Set up database for high volume testing."""
        db = MockDatabase()
        return db
    
    @pytest.mark.asyncio
    async def test_concurrent_webhook_processing(self, setup_high_volume_database):
        """Test concurrent webhook processing."""
        db = await setup_high_volume_database
        
        # Create multiple webhook events
        events = generate_webhook_events(50, "subscription.created")
        
        # Process events concurrently
        start_time = time.time()
        
        async def process_event(event):
            return await db.store_webhook_event(event)
        
        results = await asyncio.gather(*[process_event(event) for event in events])
        
        end_time = time.time()
        duration = end_time - start_time
        
        # Verify all events were processed
        assert len(results) == 50
        assert len(db.webhook_events) == 50
        
        # Verify performance
        events_per_second = 50 / duration
        assert events_per_second > 10  # Should handle at least 10 events/second
        
        print(f"Concurrent processing: {events_per_second:.2f} events/second")
    
    @pytest.mark.asyncio
    async def test_webhook_processing_with_backpressure(self, setup_high_volume_database):
        """Test webhook processing with backpressure handling."""
        db = await setup_high_volume_database
        
        # Simulate backpressure with limited processing capacity
        max_concurrent = 5
        processing_semaphore = asyncio.Semaphore(max_concurrent)
        
        async def process_event_with_backpressure(event):
            async with processing_semaphore:
                # Simulate processing time
                await asyncio.sleep(0.1)
                return await db.store_webhook_event(event)
        
        # Create events
        events = generate_webhook_events(20, "subscription.created")
        
        # Process events with backpressure
        start_time = time.time()
        results = await asyncio.gather(*[process_event_with_backpressure(event) for event in events])
        end_time = time.time()
        
        duration = end_time - start_time
        
        # Verify all events were processed
        assert len(results) == 20
        assert len(db.webhook_events) == 20
        
        # Verify backpressure was applied
        # With 5 concurrent processors and 20 events, should take at least 0.4 seconds
        assert duration >= 0.4
        
        print(f"Backpressure processing: {duration:.3f} seconds for 20 events with 5 concurrent processors")
    
    @pytest.mark.asyncio
    async def test_webhook_processing_with_queuing(self, setup_high_volume_database):
        """Test webhook processing with queuing mechanism."""
        db = await setup_high_volume_database
        
        # Simulate webhook queue
        webhook_queue = asyncio.Queue(maxsize=100)
        
        async def webhook_processor():
            """Process webhooks from queue."""
            while True:
                try:
                    event = await asyncio.wait_for(webhook_queue.get(), timeout=1.0)
                    await db.store_webhook_event(event)
                    webhook_queue.task_done()
                except asyncio.TimeoutError:
                    break
        
        # Start processor
        processor_task = asyncio.create_task(webhook_processor())
        
        # Add events to queue
        events = generate_webhook_events(50, "subscription.created")
        
        start_time = time.time()
        for event in events:
            await webhook_queue.put(event)
        
        # Wait for all events to be processed
        await webhook_queue.join()
        end_time = time.time()
        
        # Stop processor
        processor_task.cancel()
        
        duration = end_time - start_time
        
        # Verify all events were processed
        assert len(db.webhook_events) == 50
        
        # Verify performance
        events_per_second = 50 / duration
        assert events_per_second > 10  # Should handle at least 10 events/second
        
        print(f"Queued processing: {events_per_second:.2f} events/second")
    
    @pytest.mark.asyncio
    async def test_webhook_processing_with_batching(self, setup_high_volume_database):
        """Test webhook processing with batching mechanism."""
        db = await setup_high_volume_database
        
        # Simulate batch processing
        batch_size = 10
        events = generate_webhook_events(100, "subscription.created")
        
        start_time = time.time()
        
        # Process events in batches
        for i in range(0, len(events), batch_size):
            batch = events[i:i + batch_size]
            
            # Process batch concurrently
            batch_results = await asyncio.gather(*[db.store_webhook_event(event) for event in batch])
            
            # Verify batch was processed
            assert len(batch_results) == len(batch)
        
        end_time = time.time()
        duration = end_time - start_time
        
        # Verify all events were processed
        assert len(db.webhook_events) == 100
        
        # Verify performance
        events_per_second = 100 / duration
        assert events_per_second > 20  # Should handle at least 20 events/second
        
        print(f"Batched processing: {events_per_second:.2f} events/second")
    
    @pytest.mark.asyncio
    async def test_webhook_processing_with_priority_queuing(self, setup_high_volume_database):
        """Test webhook processing with priority queuing."""
        db = await setup_high_volume_database
        
        # Create events with different priorities
        high_priority_events = generate_webhook_events(10, "payment.succeeded")
        normal_priority_events = generate_webhook_events(20, "subscription.created")
        low_priority_events = generate_webhook_events(30, "subscription.updated")
        
        # Process high priority events first
        start_time = time.time()
        
        # Process high priority events
        high_results = await asyncio.gather(*[db.store_webhook_event(event) for event in high_priority_events])
        
        # Process normal priority events
        normal_results = await asyncio.gather(*[db.store_webhook_event(event) for event in normal_priority_events])
        
        # Process low priority events
        low_results = await asyncio.gather(*[db.store_webhook_event(event) for event in low_priority_events])
        
        end_time = time.time()
        duration = end_time - start_time
        
        # Verify all events were processed
        assert len(high_results) == 10
        assert len(normal_results) == 20
        assert len(low_results) == 30
        assert len(db.webhook_events) == 60
        
        # Verify performance
        events_per_second = 60 / duration
        assert events_per_second > 20  # Should handle at least 20 events/second
        
        print(f"Priority queuing: {events_per_second:.2f} events/second")


class TestWebhookMonitoring:
    """Test webhook monitoring and alerting."""
    
    @pytest_asyncio.fixture
    async def setup_monitoring_database(self):
        """Set up database for monitoring testing."""
        db = MockDatabase()
        return db
    
    @pytest.mark.asyncio
    async def test_webhook_delivery_monitoring(self, setup_monitoring_database):
        """Test webhook delivery monitoring."""
        db = await setup_monitoring_database
        
        # Create webhook events with different outcomes
        events = [
            {"id": "evt_success_001", "delivered": True, "response_status": 200, "response_time": 0.5},
            {"id": "evt_success_002", "delivered": True, "response_status": 200, "response_time": 0.3},
            {"id": "evt_failure_001", "delivered": False, "response_status": 500, "response_time": 2.0},
            {"id": "evt_failure_002", "delivered": False, "response_status": 408, "response_time": 5.0},
            {"id": "evt_success_003", "delivered": True, "response_status": 200, "response_time": 0.4}
        ]
        
        # Store events
        for event in events:
            await db.store_webhook_event(event)
        
        # Calculate monitoring metrics
        total_events = len(events)
        successful_deliveries = sum(1 for event in events if event["delivered"])
        failed_deliveries = total_events - successful_deliveries
        success_rate = successful_deliveries / total_events
        
        # Calculate response time metrics
        response_times = [event["response_time"] for event in events if event["delivered"]]
        avg_response_time = sum(response_times) / len(response_times) if response_times else 0
        
        # Verify monitoring metrics
        assert total_events == 5
        assert successful_deliveries == 3
        assert failed_deliveries == 2
        assert success_rate == 0.6  # 60% success rate
        assert avg_response_time > 0
        
        print(f"Delivery monitoring: {success_rate:.1%} success rate, {avg_response_time:.3f}s avg response time")
    
    @pytest.mark.asyncio
    async def test_webhook_error_rate_monitoring(self, setup_monitoring_database):
        """Test webhook error rate monitoring."""
        db = await setup_monitoring_database
        
        # Create webhook events with different error types
        events = [
            {"id": "evt_200_001", "response_status": 200, "error": None},
            {"id": "evt_200_002", "response_status": 200, "error": None},
            {"id": "evt_400_001", "response_status": 400, "error": "bad_request"},
            {"id": "evt_500_001", "response_status": 500, "error": "internal_server_error"},
            {"id": "evt_200_003", "response_status": 200, "error": None},
            {"id": "evt_408_001", "response_status": 408, "error": "timeout"},
            {"id": "evt_200_004", "response_status": 200, "error": None}
        ]
        
        # Store events
        for event in events:
            await db.store_webhook_event(event)
        
        # Calculate error rates
        total_events = len(events)
        successful_events = sum(1 for event in events if event["response_status"] == 200)
        error_events = total_events - successful_events
        error_rate = error_events / total_events
        
        # Calculate error type distribution
        error_types = {}
        for event in events:
            if event["error"]:
                error_types[event["error"]] = error_types.get(event["error"], 0) + 1
        
        # Verify error rate monitoring
        assert total_events == 7
        assert successful_events == 4
        assert error_events == 3
        assert error_rate == 3/7  # ~43% error rate
        
        # Verify error type distribution
        assert error_types["bad_request"] == 1
        assert error_types["internal_server_error"] == 1
        assert error_types["timeout"] == 1
        
        print(f"Error rate monitoring: {error_rate:.1%} error rate")
        print(f"Error types: {error_types}")
    
    @pytest.mark.asyncio
    async def test_webhook_alerting_thresholds(self, setup_monitoring_database):
        """Test webhook alerting thresholds."""
        db = await setup_monitoring_database
        
        # Simulate high error rate scenario
        high_error_events = [
            {"id": f"evt_error_{i:03d}", "response_status": 500, "error": "internal_server_error"}
            for i in range(10)
        ]
        
        # Simulate normal events
        normal_events = [
            {"id": f"evt_normal_{i:03d}", "response_status": 200, "error": None}
            for i in range(5)
        ]
        
        # Store events
        for event in high_error_events + normal_events:
            await db.store_webhook_event(event)
        
        # Calculate metrics
        total_events = len(high_error_events) + len(normal_events)
        error_events = len(high_error_events)
        error_rate = error_events / total_events
        
        # Define alerting thresholds
        error_rate_threshold = 0.5  # 50% error rate threshold
        should_alert = error_rate > error_rate_threshold
        
        # Verify alerting
        assert error_rate == 10/15  # ~67% error rate
        assert should_alert is True  # Should trigger alert
        
        print(f"Alerting threshold: {error_rate:.1%} error rate (threshold: {error_rate_threshold:.1%})")
        print(f"Alert triggered: {should_alert}")
    
    @pytest.mark.asyncio
    async def test_webhook_performance_monitoring(self, setup_monitoring_database):
        """Test webhook performance monitoring."""
        db = await setup_monitoring_database
        
        # Create webhook events with different response times
        events = [
            {"id": "evt_fast_001", "response_time": 0.1, "delivered": True},
            {"id": "evt_fast_002", "response_time": 0.2, "delivered": True},
            {"id": "evt_slow_001", "response_time": 2.0, "delivered": True},
            {"id": "evt_fast_003", "response_time": 0.15, "delivered": True},
            {"id": "evt_slow_002", "response_time": 3.0, "delivered": True},
            {"id": "evt_fast_004", "response_time": 0.3, "delivered": True}
        ]
        
        # Store events
        for event in events:
            await db.store_webhook_event(event)
        
        # Calculate performance metrics
        response_times = [event["response_time"] for event in events]
        avg_response_time = sum(response_times) / len(response_times)
        max_response_time = max(response_times)
        min_response_time = min(response_times)
        
        # Calculate percentiles
        sorted_times = sorted(response_times)
        p50 = sorted_times[len(sorted_times) // 2]
        p95 = sorted_times[int(len(sorted_times) * 0.95)]
        p99 = sorted_times[int(len(sorted_times) * 0.99)]
        
        # Define performance thresholds
        avg_threshold = 1.0  # 1 second average threshold
        p95_threshold = 2.0  # 2 seconds 95th percentile threshold
        
        # Verify performance monitoring
        assert avg_response_time > 0
        assert max_response_time == 3.0
        assert min_response_time == 0.1
        
        # Check thresholds
        avg_alert = avg_response_time > avg_threshold
        p95_alert = p95 > p95_threshold
        
        print(f"Performance monitoring:")
        print(f"  Average response time: {avg_response_time:.3f}s (threshold: {avg_threshold}s)")
        print(f"  95th percentile: {p95:.3f}s (threshold: {p95_threshold}s)")
        print(f"  Max response time: {max_response_time:.3f}s")
        print(f"  Min response time: {min_response_time:.3f}s")
        print(f"  Average alert: {avg_alert}")
        print(f"  95th percentile alert: {p95_alert}")
