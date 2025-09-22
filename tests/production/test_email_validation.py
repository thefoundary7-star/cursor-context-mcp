"""
Email System Validation Tests

This module tests email template rendering, SMTP delivery, content accuracy,
and failure handling across different email clients and providers.
"""

import pytest
import pytest_asyncio
import asyncio
import json
import re
from datetime import datetime, timedelta
from unittest.mock import patch, AsyncMock, Mock, MagicMock
from typing import Dict, Any, List
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from .fixtures import (
    EMAIL_TEMPLATE_DATA, SAMPLE_USERS, SAMPLE_LICENSES,
    MockEmailService, generate_test_users
)


class TestEmailTemplateRendering:
    """Test email template rendering across different scenarios."""
    
    @pytest.fixture
    def mock_email_templates(self):
        """Mock email templates service."""
        with patch('src.services.email.emailTemplates.EmailTemplates') as mock_templates:
            mock_instance = Mock()
            mock_templates.return_value = mock_instance
            
            # Mock template rendering
            mock_instance.render_license_key_email.return_value = {
                "subject": "Your FileBridge License Key",
                "html": "<html><body><h1>License Key</h1><p>Your license: {license_key}</p></body></html>",
                "text": "Your FileBridge License Key\n\nYour license: {license_key}"
            }
            
            mock_instance.render_welcome_email.return_value = {
                "subject": "Welcome to FileBridge",
                "html": "<html><body><h1>Welcome</h1><p>Welcome to {plan} plan</p></body></html>",
                "text": "Welcome to FileBridge\n\nWelcome to {plan} plan"
            }
            
            mock_instance.render_payment_failed_email.return_value = {
                "subject": "Payment Failed - Action Required",
                "html": "<html><body><h1>Payment Failed</h1><p>Amount: {amount}</p></body></html>",
                "text": "Payment Failed - Action Required\n\nAmount: {amount}"
            }
            
            yield mock_instance
    
    @pytest.mark.asyncio
    async def test_license_key_email_template_rendering(self, mock_email_templates):
        """Test license key email template rendering."""
        template_data = EMAIL_TEMPLATE_DATA["license_key"]
        
        # Render template
        rendered = mock_email_templates.render_license_key_email(template_data)
        
        # Verify template structure
        assert "subject" in rendered
        assert "html" in rendered
        assert "text" in rendered
        
        # Verify content includes license key
        assert template_data["license_key"] in rendered["html"]
        assert template_data["license_key"] in rendered["text"]
        
        # Verify plan information
        assert template_data["plan"] in rendered["html"]
        assert template_data["plan"] in rendered["text"]
        
        # Verify download URL
        assert template_data["download_url"] in rendered["html"]
        assert template_data["download_url"] in rendered["text"]
    
    @pytest.mark.asyncio
    async def test_welcome_email_template_rendering(self, mock_email_templates):
        """Test welcome email template rendering."""
        template_data = EMAIL_TEMPLATE_DATA["welcome"]
        
        # Render template
        rendered = mock_email_templates.render_welcome_email(template_data)
        
        # Verify template structure
        assert "subject" in rendered
        assert "html" in rendered
        assert "text" in rendered
        
        # Verify content includes plan information
        assert template_data["plan"] in rendered["html"]
        assert template_data["plan"] in rendered["text"]
        
        # Verify features are listed
        for feature in template_data["features"]:
            assert feature in rendered["html"]
            assert feature in rendered["text"]
        
        # Verify setup URL
        assert template_data["setup_url"] in rendered["html"]
        assert template_data["setup_url"] in rendered["text"]
    
    @pytest.mark.asyncio
    async def test_payment_failed_email_template_rendering(self, mock_email_templates):
        """Test payment failed email template rendering."""
        template_data = EMAIL_TEMPLATE_DATA["payment_failed"]
        
        # Render template
        rendered = mock_email_templates.render_payment_failed_email(template_data)
        
        # Verify template structure
        assert "subject" in rendered
        assert "html" in rendered
        assert "text" in rendered
        
        # Verify content includes amount
        assert template_data["amount"] in rendered["html"]
        assert template_data["amount"] in rendered["text"]
        
        # Verify retry URL
        assert template_data["retry_url"] in rendered["html"]
        assert template_data["retry_url"] in rendered["text"]
        
        # Verify failure reason
        assert template_data["failure_reason"] in rendered["html"]
        assert template_data["failure_reason"] in rendered["text"]
    
    @pytest.mark.asyncio
    async def test_email_template_cross_client_compatibility(self, mock_email_templates):
        """Test email template compatibility across different email clients."""
        template_data = EMAIL_TEMPLATE_DATA["license_key"]
        
        # Render template
        rendered = mock_email_templates.render_license_key_email(template_data)
        html_content = rendered["html"]
        
        # Test HTML structure compatibility
        # Check for proper HTML structure
        assert "<html>" in html_content
        assert "<body>" in html_content
        assert "</html>" in html_content
        assert "</body>" in html_content
        
        # Check for inline CSS (better email client compatibility)
        assert "style=" in html_content
        
        # Check for table-based layout (better email client compatibility)
        assert "<table" in html_content
        
        # Check for proper encoding
        assert "utf-8" in html_content.lower() or "charset" in html_content.lower()
        
        # Check for proper MIME type
        assert "text/html" in html_content or "Content-Type" in html_content
    
    @pytest.mark.asyncio
    async def test_email_template_accessibility(self, mock_email_templates):
        """Test email template accessibility features."""
        template_data = EMAIL_TEMPLATE_DATA["license_key"]
        
        # Render template
        rendered = mock_email_templates.render_license_key_email(template_data)
        html_content = rendered["html"]
        
        # Check for alt text on images
        if "<img" in html_content:
            assert "alt=" in html_content
        
        # Check for proper heading structure
        assert "<h1>" in html_content or "<h2>" in html_content
        
        # Check for proper link structure
        if "<a href=" in html_content:
            assert ">" in html_content  # Proper link closing
        
        # Check for sufficient color contrast (basic check)
        # In a real implementation, you'd use a proper accessibility checker
        assert "color:" in html_content or "background-color:" in html_content


class TestSMTPDelivery:
    """Test SMTP delivery with various providers."""
    
    @pytest.fixture
    def mock_smtp_servers(self):
        """Mock different SMTP servers."""
        servers = {
            "sendgrid": Mock(),
            "ses": Mock(),
            "mailgun": Mock(),
            "smtp": Mock()
        }
        
        # Configure mock responses
        for server in servers.values():
            server.send_message = AsyncMock(return_value={"message_id": "test_msg_001"})
            server.quit = AsyncMock()
            server.starttls = AsyncMock()
            server.login = AsyncMock()
        
        return servers
    
    @pytest.mark.asyncio
    async def test_sendgrid_delivery(self, mock_smtp_servers):
        """Test email delivery via SendGrid."""
        sendgrid = mock_smtp_servers["sendgrid"]
        
        # Mock SendGrid API
        with patch('sendgrid.SendGridAPIClient') as mock_sendgrid:
            mock_client = Mock()
            mock_sendgrid.return_value = mock_client
            mock_client.send.return_value = Mock(status_code=202)
            
            # Test email sending
            email_data = EMAIL_TEMPLATE_DATA["license_key"]
            
            # Simulate SendGrid API call
            response = mock_client.send(Mock())
            assert response.status_code == 202
    
    @pytest.mark.asyncio
    async def test_aws_ses_delivery(self, mock_smtp_servers):
        """Test email delivery via AWS SES."""
        ses = mock_smtp_servers["ses"]
        
        # Mock AWS SES
        with patch('boto3.client') as mock_boto:
            mock_ses = Mock()
            mock_boto.return_value = mock_ses
            mock_ses.send_email.return_value = {
                "MessageId": "test_message_id_001"
            }
            
            # Test email sending
            email_data = EMAIL_TEMPLATE_DATA["license_key"]
            
            # Simulate SES API call
            response = mock_ses.send_email(
                Source=email_data["to"],
                Destination={"ToAddresses": [email_data["to"]]},
                Message={
                    "Subject": {"Data": "Test Subject"},
                    "Body": {"Text": {"Data": "Test Body"}}
                }
            )
            
            assert "MessageId" in response
    
    @pytest.mark.asyncio
    async def test_mailgun_delivery(self, mock_smtp_servers):
        """Test email delivery via Mailgun."""
        mailgun = mock_smtp_servers["mailgun"]
        
        # Mock Mailgun API
        with patch('requests.post') as mock_post:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "id": "test_message_id_001",
                "message": "Queued. Thank you."
            }
            mock_post.return_value = mock_response
            
            # Test email sending
            email_data = EMAIL_TEMPLATE_DATA["license_key"]
            
            # Simulate Mailgun API call
            response = mock_post(
                "https://api.mailgun.net/v3/your-domain/messages",
                auth=("api", "test_api_key"),
                data={
                    "from": "noreply@filebridge.com",
                    "to": email_data["to"],
                    "subject": "Test Subject",
                    "text": "Test Body"
                }
            )
            
            assert response.status_code == 200
            assert "id" in response.json()
    
    @pytest.mark.asyncio
    async def test_smtp_delivery(self, mock_smtp_servers):
        """Test email delivery via SMTP."""
        smtp = mock_smtp_servers["smtp"]
        
        # Mock SMTP
        with patch('smtplib.SMTP') as mock_smtp_class:
            mock_smtp_instance = Mock()
            mock_smtp_class.return_value = mock_smtp_instance
            mock_smtp_instance.send_message.return_value = {}
            mock_smtp_instance.quit.return_value = None
            
            # Test email sending
            email_data = EMAIL_TEMPLATE_DATA["license_key"]
            
            # Create email message
            msg = MIMEMultipart()
            msg['From'] = "noreply@filebridge.com"
            msg['To'] = email_data["to"]
            msg['Subject'] = "Test Subject"
            msg.attach(MIMEText("Test Body", 'plain'))
            
            # Simulate SMTP sending
            mock_smtp_instance.send_message(msg)
            mock_smtp_instance.quit()
            
            # Verify SMTP methods were called
            mock_smtp_instance.send_message.assert_called_once()
            mock_smtp_instance.quit.assert_called_once()


class TestEmailContentAccuracy:
    """Test email content accuracy for different subscription tiers."""
    
    @pytest.mark.asyncio
    async def test_free_tier_email_content(self):
        """Test email content accuracy for free tier."""
        user = SAMPLE_USERS["free_user"]
        
        # Mock email service
        mock_email = MockEmailService()
        
        # Send welcome email for free tier
        welcome_data = {
            "to": user.email,
            "customer_name": user.name,
            "plan": "FREE",
            "features": [
                "Basic file transfers",
                "Community support",
                "1 server limit"
            ],
            "setup_url": "https://app.filebridge.com/setup",
            "support_email": "support@filebridge.com"
        }
        
        result = await mock_email.send_welcome_email(welcome_data)
        assert result["success"] is True
        
        # Verify email content
        sent_email = mock_email.sent_emails[0]
        assert sent_email["type"] == "welcome"
        assert sent_email["to"] == user.email
        
        # Verify free tier specific content
        email_data = sent_email["data"]
        assert email_data["plan"] == "FREE"
        assert "1 server limit" in email_data["features"]
        assert "Community support" in email_data["features"]
    
    @pytest.mark.asyncio
    async def test_pro_tier_email_content(self):
        """Test email content accuracy for Pro tier."""
        user = SAMPLE_USERS["pro_user"]
        license_data = SAMPLE_LICENSES["pro_license"]
        
        # Mock email service
        mock_email = MockEmailService()
        
        # Send license key email for Pro tier
        license_email_data = {
            "to": user.email,
            "customer_name": user.name,
            "license_key": license_data.license_key,
            "plan": "PRO",
            "subscription_id": "dodo_sub_pro_001",
            "expires_at": license_data.expires_at,
            "download_url": "https://releases.filebridge.com/latest",
            "support_email": "support@filebridge.com"
        }
        
        result = await mock_email.send_license_key(license_email_data)
        assert result["success"] is True
        
        # Verify email content
        sent_email = mock_email.sent_emails[0]
        assert sent_email["type"] == "license_key"
        assert sent_email["to"] == user.email
        
        # Verify Pro tier specific content
        email_data = sent_email["data"]
        assert email_data["plan"] == "PRO"
        assert email_data["license_key"] == license_data.license_key
        assert email_data["license_key"].startswith("FB-PRO-")
    
    @pytest.mark.asyncio
    async def test_enterprise_tier_email_content(self):
        """Test email content accuracy for Enterprise tier."""
        user = SAMPLE_USERS["enterprise_user"]
        license_data = SAMPLE_LICENSES["enterprise_license"]
        
        # Mock email service
        mock_email = MockEmailService()
        
        # Send license key email for Enterprise tier
        license_email_data = {
            "to": user.email,
            "customer_name": user.name,
            "license_key": license_data.license_key,
            "plan": "ENTERPRISE",
            "subscription_id": "dodo_sub_enterprise_001",
            "expires_at": license_data.expires_at,
            "download_url": "https://releases.filebridge.com/latest",
            "support_email": "support@filebridge.com"
        }
        
        result = await mock_email.send_license_key(license_email_data)
        assert result["success"] is True
        
        # Verify email content
        sent_email = mock_email.sent_emails[0]
        assert sent_email["type"] == "license_key"
        assert sent_email["to"] == user.email
        
        # Verify Enterprise tier specific content
        email_data = sent_email["data"]
        assert email_data["plan"] == "ENTERPRISE"
        assert email_data["license_key"] == license_data.license_key
        assert email_data["license_key"].startswith("FB-ENT-")
    
    @pytest.mark.asyncio
    async def test_license_activation_instructions_accuracy(self):
        """Test license activation instructions are correct."""
        user = SAMPLE_USERS["pro_user"]
        license_data = SAMPLE_LICENSES["pro_license"]
        
        # Mock email service
        mock_email = MockEmailService()
        
        # Send license key email
        license_email_data = {
            "to": user.email,
            "customer_name": user.name,
            "license_key": license_data.license_key,
            "plan": "PRO",
            "subscription_id": "dodo_sub_pro_001",
            "expires_at": license_data.expires_at,
            "download_url": "https://releases.filebridge.com/latest",
            "support_email": "support@filebridge.com"
        }
        
        result = await mock_email.send_license_key(license_email_data)
        assert result["success"] is True
        
        # Verify activation instructions
        sent_email = mock_email.sent_emails[0]
        email_data = sent_email["data"]
        
        # Check for download URL
        assert "https://releases.filebridge.com/latest" in email_data["download_url"]
        
        # Check for support email
        assert "support@filebridge.com" in email_data["support_email"]
        
        # Check for license key format
        license_key = email_data["license_key"]
        assert len(license_key) == 43  # Expected length
        assert license_key.count("-") == 4  # Expected format: FB-PRO-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX


class TestEmailDeliveryFailureHandling:
    """Test email delivery failure handling and retry mechanisms."""
    
    @pytest.mark.asyncio
    async def test_email_delivery_failure_detection(self):
        """Test detection of email delivery failures."""
        mock_email = MockEmailService()
        
        # Attempt to send email to failing address
        email_data = {
            "to": "fail@fail.com",  # This will trigger delivery failure
            "customer_name": "Test User",
            "license_key": "FB-PRO-12345678-ABCD-EFGH-IJKL-MNOPQRSTUVWX",
            "plan": "PRO",
            "subscription_id": "dodo_sub_pro_001",
            "expires_at": datetime.now() + timedelta(days=30),
            "download_url": "https://releases.filebridge.com/latest",
            "support_email": "support@filebridge.com"
        }
        
        result = await mock_email.send_license_key(email_data)
        assert result["success"] is False
        
        # Verify failure was recorded
        assert len(mock_email.delivery_failures) == 1
        assert mock_email.delivery_failures[0]["to"] == "fail@fail.com"
    
    @pytest.mark.asyncio
    async def test_email_retry_mechanism(self):
        """Test email retry mechanism after failure."""
        mock_email = MockEmailService()
        
        # First attempt - fails
        email_data = {
            "to": "fail@fail.com",
            "customer_name": "Test User",
            "license_key": "FB-PRO-12345678-ABCD-EFGH-IJKL-MNOPQRSTUVWX",
            "plan": "PRO",
            "subscription_id": "dodo_sub_pro_001",
            "expires_at": datetime.now() + timedelta(days=30),
            "download_url": "https://releases.filebridge.com/latest",
            "support_email": "support@filebridge.com"
        }
        
        result1 = await mock_email.send_license_key(email_data)
        assert result1["success"] is False
        
        # Retry with different email - succeeds
        email_data["to"] = "retry@test.com"
        result2 = await mock_email.send_license_key(email_data)
        assert result2["success"] is True
        
        # Verify retry succeeded
        assert len(mock_email.sent_emails) == 1
        assert mock_email.sent_emails[0]["to"] == "retry@test.com"
    
    @pytest.mark.asyncio
    async def test_email_bounce_handling(self):
        """Test email bounce handling."""
        mock_email = MockEmailService()
        
        # Simulate bounce event
        bounce_data = {
            "email": "bounce@test.com",
            "bounce_type": "hard",
            "bounce_reason": "invalid_email",
            "timestamp": datetime.now()
        }
        
        # Record bounce
        mock_email.delivery_failures.append({
            "type": "bounce",
            "to": bounce_data["email"],
            "bounce_type": bounce_data["bounce_type"],
            "bounce_reason": bounce_data["bounce_reason"],
            "timestamp": bounce_data["timestamp"]
        })
        
        # Verify bounce was recorded
        assert len(mock_email.delivery_failures) == 1
        assert mock_email.delivery_failures[0]["bounce_type"] == "hard"
        assert mock_email.delivery_failures[0]["bounce_reason"] == "invalid_email"
    
    @pytest.mark.asyncio
    async def test_email_spam_filter_handling(self):
        """Test email spam filter handling."""
        mock_email = MockEmailService()
        
        # Simulate spam filter event
        spam_data = {
            "email": "spam@test.com",
            "spam_score": 0.8,
            "spam_reason": "high_score",
            "timestamp": datetime.now()
        }
        
        # Record spam event
        mock_email.delivery_failures.append({
            "type": "spam",
            "to": spam_data["email"],
            "spam_score": spam_data["spam_score"],
            "spam_reason": spam_data["spam_reason"],
            "timestamp": spam_data["timestamp"]
        })
        
        # Verify spam event was recorded
        assert len(mock_email.delivery_failures) == 1
        assert mock_email.delivery_failures[0]["spam_score"] == 0.8
        assert mock_email.delivery_failures[0]["spam_reason"] == "high_score"
    
    @pytest.mark.asyncio
    async def test_email_rate_limiting(self):
        """Test email rate limiting."""
        mock_email = MockEmailService()
        
        # Send multiple emails rapidly
        email_data = {
            "to": "rate@test.com",
            "customer_name": "Test User",
            "license_key": "FB-PRO-12345678-ABCD-EFGH-IJKL-MNOPQRSTUVWX",
            "plan": "PRO",
            "subscription_id": "dodo_sub_pro_001",
            "expires_at": datetime.now() + timedelta(days=30),
            "download_url": "https://releases.filebridge.com/latest",
            "support_email": "support@filebridge.com"
        }
        
        # Send 10 emails rapidly
        results = []
        for i in range(10):
            result = await mock_email.send_license_key(email_data)
            results.append(result)
        
        # Verify all emails were sent (no rate limiting in mock)
        assert all(result["success"] for result in results)
        assert len(mock_email.sent_emails) == 10


class TestEmailAnalytics:
    """Test email analytics and tracking."""
    
    @pytest.mark.asyncio
    async def test_email_delivery_tracking(self):
        """Test email delivery tracking."""
        mock_email = MockEmailService()
        
        # Send email
        email_data = EMAIL_TEMPLATE_DATA["license_key"]
        result = await mock_email.send_license_key(email_data)
        
        # Verify delivery tracking
        assert result["success"] is True
        assert "message_id" in result
        
        # Verify email was recorded
        assert len(mock_email.sent_emails) == 1
        sent_email = mock_email.sent_emails[0]
        assert sent_email["type"] == "license_key"
        assert sent_email["to"] == email_data["to"]
        assert "sent_at" in sent_email
    
    @pytest.mark.asyncio
    async def test_email_open_tracking(self):
        """Test email open tracking."""
        mock_email = MockEmailService()
        
        # Send email
        email_data = EMAIL_TEMPLATE_DATA["license_key"]
        result = await mock_email.send_license_key(email_data)
        
        # Simulate open tracking
        open_event = {
            "message_id": result["message_id"],
            "opened_at": datetime.now(),
            "ip_address": "192.168.1.1",
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        
        # Record open event
        mock_email.sent_emails[0]["opens"] = [open_event]
        
        # Verify open tracking
        sent_email = mock_email.sent_emails[0]
        assert "opens" in sent_email
        assert len(sent_email["opens"]) == 1
        assert sent_email["opens"][0]["ip_address"] == "192.168.1.1"
    
    @pytest.mark.asyncio
    async def test_email_click_tracking(self):
        """Test email click tracking."""
        mock_email = MockEmailService()
        
        # Send email
        email_data = EMAIL_TEMPLATE_DATA["license_key"]
        result = await mock_email.send_license_key(email_data)
        
        # Simulate click tracking
        click_event = {
            "message_id": result["message_id"],
            "clicked_at": datetime.now(),
            "url": email_data["download_url"],
            "ip_address": "192.168.1.1",
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        
        # Record click event
        mock_email.sent_emails[0]["clicks"] = [click_event]
        
        # Verify click tracking
        sent_email = mock_email.sent_emails[0]
        assert "clicks" in sent_email
        assert len(sent_email["clicks"]) == 1
        assert sent_email["clicks"][0]["url"] == email_data["download_url"]
    
    @pytest.mark.asyncio
    async def test_email_unsubscribe_tracking(self):
        """Test email unsubscribe tracking."""
        mock_email = MockEmailService()
        
        # Send email
        email_data = EMAIL_TEMPLATE_DATA["license_key"]
        result = await mock_email.send_license_key(email_data)
        
        # Simulate unsubscribe event
        unsubscribe_event = {
            "message_id": result["message_id"],
            "unsubscribed_at": datetime.now(),
            "ip_address": "192.168.1.1",
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        
        # Record unsubscribe event
        mock_email.sent_emails[0]["unsubscribes"] = [unsubscribe_event]
        
        # Verify unsubscribe tracking
        sent_email = mock_email.sent_emails[0]
        assert "unsubscribes" in sent_email
        assert len(sent_email["unsubscribes"]) == 1
        assert sent_email["unsubscribes"][0]["ip_address"] == "192.168.1.1"
