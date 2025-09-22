#!/usr/bin/env python3
"""
Test Environment Setup Script

This script sets up the test environment for FileBridge production validation tests.
It installs dependencies, configures environment variables, and validates the setup.
"""

import os
import sys
import subprocess
import json
from pathlib import Path
from typing import Dict, Any, List


class TestEnvironmentSetup:
    """Test environment setup and validation."""
    
    def __init__(self, project_root: str = "."):
        self.project_root = Path(project_root)
        self.test_dir = self.project_root / "tests" / "production"
        
        # Required Python packages
        self.required_packages = [
            "pytest",
            "pytest-asyncio",
            "aiohttp",
            "aiofiles",
            "psutil",
            "pydantic",
            "python-dateutil",
            "orjson",
            "python-dotenv",
            "sqlalchemy",
            "alembic",
            "responses",
            "freezegun",
            "locust",
            "cryptography",
            "faker"
        ]
        
        # Required Node.js packages
        self.required_node_packages = [
            "artillery"
        ]
        
        # Environment variables to check
        self.required_env_vars = [
            "DATABASE_URL",
            "DODO_WEBHOOK_SECRET",
            "DODO_PRO_PRODUCT_ID",
            "DODO_ENTERPRISE_PRODUCT_ID",
            "SENDGRID_API_KEY",
            "SUPPORT_EMAIL",
            "JWT_SECRET"
        ]
    
    def check_python_version(self) -> bool:
        """Check if Python version is compatible."""
        print("Checking Python version...")
        
        version = sys.version_info
        if version.major < 3 or (version.major == 3 and version.minor < 8):
            print(f"❌ Python {version.major}.{version.minor} is not supported. Please use Python 3.8 or higher.")
            return False
        
        print(f"✅ Python {version.major}.{version.minor}.{version.micro} is compatible")
        return True
    
    def install_python_packages(self) -> bool:
        """Install required Python packages."""
        print("Installing Python packages...")
        
        try:
            # Install from requirements.txt if it exists
            requirements_file = self.test_dir / "requirements.txt"
            if requirements_file.exists():
                subprocess.run([
                    sys.executable, "-m", "pip", "install", "-r", str(requirements_file)
                ], check=True, capture_output=True)
                print("✅ Python packages installed from requirements.txt")
            else:
                # Install individual packages
                for package in self.required_packages:
                    try:
                        subprocess.run([
                            sys.executable, "-m", "pip", "install", package
                        ], check=True, capture_output=True)
                        print(f"✅ Installed {package}")
                    except subprocess.CalledProcessError:
                        print(f"❌ Failed to install {package}")
                        return False
            
            return True
            
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to install Python packages: {e}")
            return False
    
    def check_node_installation(self) -> bool:
        """Check if Node.js is installed."""
        print("Checking Node.js installation...")
        
        try:
            result = subprocess.run(
                ["node", "--version"],
                capture_output=True,
                text=True,
                check=True
            )
            print(f"✅ Node.js {result.stdout.strip()} is installed")
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("❌ Node.js is not installed. Please install Node.js from https://nodejs.org/")
            return False
    
    def install_node_packages(self) -> bool:
        """Install required Node.js packages."""
        print("Installing Node.js packages...")
        
        try:
            for package in self.required_node_packages:
                subprocess.run([
                    "npm", "install", "-g", package
                ], check=True, capture_output=True)
                print(f"✅ Installed {package}")
            
            return True
            
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to install Node.js packages: {e}")
            return False
    
    def check_environment_variables(self) -> bool:
        """Check if required environment variables are set."""
        print("Checking environment variables...")
        
        missing_vars = []
        for var in self.required_env_vars:
            if not os.getenv(var):
                missing_vars.append(var)
        
        if missing_vars:
            print("❌ Missing environment variables:")
            for var in missing_vars:
                print(f"   - {var}")
            print("\nPlease set these environment variables or create a .env file")
            return False
        
        print("✅ All required environment variables are set")
        return True
    
    def create_env_template(self) -> None:
        """Create environment template file."""
        print("Creating environment template...")
        
        env_template = self.project_root / ".env.template"
        
        template_content = """# FileBridge Production Test Environment Variables

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/filebridge

# Dodo Payments
DODO_WEBHOOK_SECRET=your_webhook_secret_here
DODO_PRO_PRODUCT_ID=prod_pro_monthly
DODO_ENTERPRISE_PRODUCT_ID=prod_enterprise_monthly

# Email
SENDGRID_API_KEY=your_sendgrid_api_key_here
SUPPORT_EMAIL=support@filebridge.com

# JWT
JWT_SECRET=your_jwt_secret_here

# Test Environment
NODE_ENV=test
TESTING=true
"""
        
        with open(env_template, 'w') as f:
            f.write(template_content)
        
        print(f"✅ Environment template created: {env_template}")
    
    def validate_test_files(self) -> bool:
        """Validate that all test files exist."""
        print("Validating test files...")
        
        required_files = [
            "fixtures.py",
            "test_e2e_payment_flow.py",
            "test_email_validation.py",
            "test_database_performance.py",
            "test_webhook_reliability.py",
            "test_user_license_activation.py",
            "artillery_config.yml",
            "artillery_webhook_load.yml",
            "artillery_database_load.yml",
            "run_load_tests.py",
            "test_runner.py",
            "README.md"
        ]
        
        missing_files = []
        for file in required_files:
            file_path = self.test_dir / file
            if not file_path.exists():
                missing_files.append(file)
        
        if missing_files:
            print("❌ Missing test files:")
            for file in missing_files:
                print(f"   - {file}")
            return False
        
        print("✅ All test files are present")
        return True
    
    def run_basic_validation(self) -> bool:
        """Run basic validation tests."""
        print("Running basic validation tests...")
        
        try:
            # Test Python imports
            import pytest
            import pytest_asyncio
            import aiohttp
            import aiofiles
            import psutil
            print("✅ Python packages can be imported")
            
            # Test Node.js packages
            result = subprocess.run(
                ["artillery", "--version"],
                capture_output=True,
                text=True,
                check=True
            )
            print(f"✅ Artillery is available: {result.stdout.strip()}")
            
            return True
            
        except ImportError as e:
            print(f"❌ Import error: {e}")
            return False
        except subprocess.CalledProcessError as e:
            print(f"❌ Artillery test failed: {e}")
            return False
    
    def setup_directories(self) -> None:
        """Create necessary directories."""
        print("Setting up directories...")
        
        directories = [
            "test_results",
            "test_results/production_validation",
            "test_results/load_tests",
            "logs"
        ]
        
        for directory in directories:
            dir_path = self.project_root / directory
            dir_path.mkdir(parents=True, exist_ok=True)
            print(f"✅ Created directory: {directory}")
    
    def generate_setup_report(self, setup_results: Dict[str, bool]) -> str:
        """Generate setup report."""
        report_file = self.project_root / "test_results" / "setup_report.md"
        
        with open(report_file, 'w') as f:
            f.write("# FileBridge Test Environment Setup Report\n\n")
            f.write(f"**Generated:** {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            f.write("## Setup Results\n\n")
            
            for check, result in setup_results.items():
                status = "✅ PASSED" if result else "❌ FAILED"
                f.write(f"- **{check}:** {status}\n")
            
            f.write("\n## Next Steps\n\n")
            
            if all(setup_results.values()):
                f.write("🎉 **Setup completed successfully!**\n\n")
                f.write("You can now run the production validation tests:\n\n")
                f.write("```bash\n")
                f.write("# Run all tests\n")
                f.write("python tests/production/test_runner.py\n\n")
                f.write("# Run specific test categories\n")
                f.write("python tests/production/test_runner.py --categories e2e\n")
                f.write("python tests/production/test_runner.py --categories load\n")
                f.write("```\n")
            else:
                f.write("❌ **Setup incomplete.** Please address the following issues:\n\n")
                
                for check, result in setup_results.items():
                    if not result:
                        f.write(f"- **{check}:** Failed - see output above for details\n")
                
                f.write("\nAfter fixing the issues, run this setup script again.\n")
        
        return str(report_file)
    
    def run_setup(self) -> bool:
        """Run complete setup process."""
        print("FileBridge Test Environment Setup")
        print("=" * 50)
        
        setup_results = {}
        
        # Check Python version
        setup_results["Python Version"] = self.check_python_version()
        
        # Install Python packages
        setup_results["Python Packages"] = self.install_python_packages()
        
        # Check Node.js
        setup_results["Node.js Installation"] = self.check_node_installation()
        
        # Install Node.js packages
        if setup_results["Node.js Installation"]:
            setup_results["Node.js Packages"] = self.install_node_packages()
        else:
            setup_results["Node.js Packages"] = False
        
        # Check environment variables
        setup_results["Environment Variables"] = self.check_environment_variables()
        
        # Create environment template if needed
        if not setup_results["Environment Variables"]:
            self.create_env_template()
        
        # Validate test files
        setup_results["Test Files"] = self.validate_test_files()
        
        # Setup directories
        self.setup_directories()
        setup_results["Directories"] = True
        
        # Run basic validation
        setup_results["Basic Validation"] = self.run_basic_validation()
        
        # Generate report
        report_file = self.generate_setup_report(setup_results)
        
        print("\n" + "=" * 50)
        print("SETUP SUMMARY")
        print("=" * 50)
        
        for check, result in setup_results.items():
            status = "✅ PASSED" if result else "❌ FAILED"
            print(f"{check}: {status}")
        
        print(f"\nSetup report generated: {report_file}")
        
        return all(setup_results.values())


def main():
    """Main function."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Set up FileBridge test environment")
    parser.add_argument(
        "--project-root",
        default=".",
        help="Project root directory"
    )
    
    args = parser.parse_args()
    
    # Create setup instance
    setup = TestEnvironmentSetup(args.project_root)
    
    # Run setup
    success = setup.run_setup()
    
    if success:
        print("\n🎉 Test environment setup completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Test environment setup failed. Please check the report for details.")
        sys.exit(1)


if __name__ == "__main__":
    main()
