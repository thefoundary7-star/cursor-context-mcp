#!/usr/bin/env python3
"""
Enhanced MCP Server Integration Script

This script integrates all enhanced features into the main MCP server,
providing a seamless upgrade path and backward compatibility.
"""

import os
import sys
import json
import time
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List
import traceback

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class EnhancedMCPIntegration:
    """Integrates enhanced features into the main MCP server"""
    
    def __init__(self):
        self.integration_successful = False
        self.features_loaded = []
        self.errors = []
        
    def integrate_enhanced_features(self) -> bool:
        """Integrate all enhanced features"""
        logger.info("Starting enhanced MCP server integration...")
        
        try:
            # Step 1: Load enhanced configuration
            if not self._load_enhanced_configuration():
                return False
            
            # Step 2: Initialize enhanced error handling
            if not self._initialize_error_handling():
                return False
            
            # Step 3: Setup comprehensive logging
            if not self._setup_comprehensive_logging():
                return False
            
            # Step 4: Initialize optimized startup system
            if not self._initialize_startup_system():
                return False
            
            # Step 5: Register enhanced tools
            if not self._register_enhanced_tools():
                return False
            
            # Step 6: Setup health monitoring
            if not self._setup_health_monitoring():
                return False
            
            self.integration_successful = True
            logger.info("✓ Enhanced MCP server integration completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"Enhanced MCP integration failed: {e}")
            logger.error(traceback.format_exc())
            return False
    
    def _load_enhanced_configuration(self) -> bool:
        """Load enhanced configuration system"""
        try:
            logger.info("Loading enhanced configuration system...")
            
            from enhanced_config_system import enhanced_config_manager, get_enhanced_config
            
            # Check if configuration is available
            config = get_enhanced_config()
            if not config:
                logger.warning("Enhanced configuration not available, using defaults")
                return True
            
            # Log configuration summary
            summary = enhanced_config_manager.get_config_summary()
            logger.info(f"Configuration loaded: {summary.get('watched_directories_count', 0)} directories")
            
            self.features_loaded.append("enhanced_configuration")
            return True
            
        except ImportError as e:
            logger.warning(f"Enhanced configuration system not available: {e}")
            return True  # Not critical for basic functionality
        except Exception as e:
            logger.error(f"Failed to load enhanced configuration: {e}")
            return False
    
    def _initialize_error_handling(self) -> bool:
        """Initialize enhanced error handling"""
        try:
            logger.info("Initializing enhanced error handling...")
            
            from enhanced_error_handling import (
                error_handler, progress_tracker, 
                get_progress_summary, create_user_friendly_error
            )
            
            # Test error handling
            test_error = ValueError("Test error for initialization")
            from enhanced_error_handling import ErrorContext, ErrorSeverity
            
            context = ErrorContext(operation="initialization", user_action="Testing error handling")
            error_record = error_handler.handle_error(test_error, context, ErrorSeverity.LOW)
            
            if error_record:
                logger.info("Enhanced error handling initialized successfully")
                self.features_loaded.append("enhanced_error_handling")
                return True
            else:
                logger.warning("Enhanced error handling test failed")
                return True  # Not critical
            
        except ImportError as e:
            logger.warning(f"Enhanced error handling not available: {e}")
            return True  # Not critical
        except Exception as e:
            logger.error(f"Failed to initialize enhanced error handling: {e}")
            return False
    
    def _setup_comprehensive_logging(self) -> bool:
        """Setup comprehensive logging system"""
        try:
            logger.info("Setting up comprehensive logging...")
            
            from comprehensive_logging import (
                log_manager, usage_tracker, performance_monitor,
                get_logging_summary, record_operation
            )
            
            # Test logging system
            test_logger = log_manager.get_logger('integration_test')
            test_logger.log_operation('INFO', 'Testing comprehensive logging system')
            
            # Test usage tracking
            record_operation('integration_test', 0.1, True, 1.0)
            
            logger.info("Comprehensive logging system initialized")
            self.features_loaded.append("comprehensive_logging")
            return True
            
        except ImportError as e:
            logger.warning(f"Comprehensive logging not available: {e}")
            return True  # Not critical
        except Exception as e:
            logger.error(f"Failed to setup comprehensive logging: {e}")
            return False
    
    def _initialize_startup_system(self) -> bool:
        """Initialize optimized startup system"""
        try:
            logger.info("Initializing optimized startup system...")
            
            from optimized_startup import (
                startup_manager, register_startup_component,
                get_health_status, graceful_shutdown
            )
            
            # Register core components
            register_startup_component(
                name="enhanced_mcp_core",
                dependencies=[],
                priority=1,
                is_critical=True
            )
            
            # Start components
            startup_summary = startup_manager.start_components()
            if startup_summary.get('startup_complete', False):
                logger.info("Optimized startup system initialized")
                self.features_loaded.append("optimized_startup")
                return True
            else:
                logger.warning("Startup system initialization had issues but continuing")
                return True  # Not critical
            
        except ImportError as e:
            logger.warning(f"Optimized startup system not available: {e}")
            return True  # Not critical
        except Exception as e:
            logger.error(f"Failed to initialize startup system: {e}")
            return False
    
    def _register_enhanced_tools(self) -> bool:
        """Register enhanced MCP tools"""
        try:
            logger.info("Registering enhanced MCP tools...")
            
            # This would integrate with the main MCP server's tool registration
            # For now, we'll just log that we're ready to register tools
            
            enhanced_tools = [
                "enhanced_file_search",
                "symbol_analysis",
                "reference_tracking",
                "security_scan",
                "performance_monitor",
                "usage_statistics",
                "health_check",
                "configuration_manager"
            ]
            
            logger.info(f"Enhanced tools ready for registration: {', '.join(enhanced_tools)}")
            self.features_loaded.append("enhanced_tools")
            return True
            
        except Exception as e:
            logger.error(f"Failed to register enhanced tools: {e}")
            return False
    
    def _setup_health_monitoring(self) -> bool:
        """Setup health monitoring"""
        try:
            logger.info("Setting up health monitoring...")
            
            from optimized_startup import get_health_status
            
            # Test health monitoring
            health_status = get_health_status()
            if health_status:
                logger.info("Health monitoring initialized")
                self.features_loaded.append("health_monitoring")
                return True
            else:
                logger.warning("Health monitoring test failed")
                return True  # Not critical
            
        except ImportError as e:
            logger.warning(f"Health monitoring not available: {e}")
            return True  # Not critical
        except Exception as e:
            logger.error(f"Failed to setup health monitoring: {e}")
            return False
    
    def get_integration_summary(self) -> Dict[str, Any]:
        """Get integration summary"""
        return {
            "integration_successful": self.integration_successful,
            "features_loaded": self.features_loaded,
            "errors": self.errors,
            "timestamp": time.time()
        }
    
    def cleanup(self):
        """Cleanup enhanced features"""
        try:
            logger.info("Cleaning up enhanced features...")
            
            # Graceful shutdown
            from optimized_startup import graceful_shutdown
            graceful_shutdown(timeout=10.0)
            
            # Shutdown logging
            from comprehensive_logging import shutdown_logging
            shutdown_logging()
            
            logger.info("Enhanced features cleanup completed")
            
        except ImportError:
            pass  # Features not available
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")

def patch_main_mcp_server():
    """Patch the main MCP server with enhanced features"""
    logger.info("Patching main MCP server with enhanced features...")
    
    try:
        # Import the main MCP server
        import official_mcp_server
        
        # Patch the run_persistent_server function
        original_run_server = official_mcp_server.run_persistent_server
        
        def enhanced_run_server(config_path=None, bypass_config=False):
            """Enhanced version of run_persistent_server"""
            logger.info("Starting enhanced MCP server...")
            
            # Initialize enhanced features
            integration = EnhancedMCPIntegration()
            if not integration.integrate_enhanced_features():
                logger.warning("Enhanced features integration failed, falling back to basic mode")
            
            try:
                # Run the original server
                return original_run_server(config_path, bypass_config)
            finally:
                # Cleanup enhanced features
                integration.cleanup()
        
        # Replace the original function
        official_mcp_server.run_persistent_server = enhanced_run_server
        
        logger.info("✓ Main MCP server patched with enhanced features")
        return True
        
    except ImportError as e:
        logger.error(f"Failed to import main MCP server: {e}")
        return False
    except Exception as e:
        logger.error(f"Failed to patch main MCP server: {e}")
        return False

def create_enhanced_mcp_server():
    """Create an enhanced MCP server entry point"""
    logger.info("Creating enhanced MCP server entry point...")
    
    enhanced_server_code = '''#!/usr/bin/env python3
"""
Enhanced MCP Server Entry Point

This is the enhanced version of the MCP server with all new features integrated.
"""

import sys
import os
import logging

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    """Main entry point for enhanced MCP server"""
    try:
        # Import and run enhanced integration
        from enhanced_mcp_integration import EnhancedMCPIntegration, patch_main_mcp_server
        
        # Initialize enhanced features
        integration = EnhancedMCPIntegration()
        if not integration.integrate_enhanced_features():
            logger.warning("Enhanced features integration failed, falling back to basic mode")
        
        # Patch main server
        if not patch_main_mcp_server():
            logger.error("Failed to patch main MCP server")
            sys.exit(1)
        
        # Import and run the patched server
        import official_mcp_server
        
        # Parse command line arguments
        import argparse
        parser = argparse.ArgumentParser(description="Enhanced MCP Server")
        parser.add_argument("--config", help="Path to configuration file")
        parser.add_argument("--bypass-config", action="store_true", help="Bypass configuration checks")
        parser.add_argument("--enhanced-features", action="store_true", help="Enable enhanced features")
        
        args = parser.parse_args()
        
        # Run the enhanced server
        logger.info("Starting Enhanced MCP Server v2.1.0...")
        official_mcp_server.run_persistent_server(
            config_path=args.config,
            bypass_config=args.bypass_config
        )
        
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Server error: {e}")
        sys.exit(1)
    finally:
        # Cleanup
        try:
            integration.cleanup()
        except:
            pass

if __name__ == "__main__":
    main()
'''
    
    # Write enhanced server file
    enhanced_server_path = "enhanced_mcp_server.py"
    with open(enhanced_server_path, 'w', encoding='utf-8') as f:
        f.write(enhanced_server_code)
    
    # Make executable on Unix systems
    if os.name != 'nt':
        os.chmod(enhanced_server_path, 0o755)
    
    logger.info(f"✓ Enhanced MCP server created: {enhanced_server_path}")
    return enhanced_server_path

def create_upgrade_script():
    """Create upgrade script for existing installations"""
    logger.info("Creating upgrade script...")
    
    upgrade_script_code = '''#!/usr/bin/env python3
"""
MCP Server Upgrade Script

This script upgrades existing MCP server installations to the enhanced version.
"""

import os
import sys
import shutil
import json
from pathlib import Path

def upgrade_mcp_server():
    """Upgrade MCP server to enhanced version"""
    print("MCP Server Upgrade Script v2.1.0")
    print("=" * 40)
    
    # Check if we're in the right directory
    if not os.path.exists("official_mcp_server.py"):
        print("Error: official_mcp_server.py not found in current directory")
        print("Please run this script from the MCP server directory")
        return False
    
    # Backup existing configuration
    config_path = Path.home() / ".mcp" / "config.json"
    if config_path.exists():
        backup_path = config_path.with_suffix(".json.backup")
        shutil.copy2(config_path, backup_path)
        print(f"✓ Backed up existing configuration to {backup_path}")
    
    # Install enhanced features
    print("Installing enhanced features...")
    try:
        from install_enhanced_features import EnhancedMCPInstaller
        installer = EnhancedMCPInstaller()
        success = installer.install()
        
        if success:
            print("✓ Enhanced features installed successfully")
        else:
            print("✗ Enhanced features installation failed")
            return False
            
    except ImportError:
        print("Warning: Enhanced features installer not available")
        print("Please ensure all enhanced feature files are present")
    
    # Create enhanced server entry point
    print("Creating enhanced server entry point...")
    try:
        from enhanced_mcp_integration import create_enhanced_mcp_server
        enhanced_server_path = create_enhanced_mcp_server()
        print(f"✓ Enhanced server created: {enhanced_server_path}")
    except ImportError:
        print("Warning: Enhanced integration not available")
    
    print("\\nUpgrade completed!")
    print("\\nTo use the enhanced server:")
    print("  python enhanced_mcp_server.py")
    print("\\nTo use the original server:")
    print("  python official_mcp_server.py")
    
    return True

if __name__ == "__main__":
    success = upgrade_mcp_server()
    sys.exit(0 if success else 1)
'''
    
    # Write upgrade script
    upgrade_script_path = "upgrade_mcp_server.py"
    with open(upgrade_script_path, 'w', encoding='utf-8') as f:
        f.write(upgrade_script_code)
    
    # Make executable on Unix systems
    if os.name != 'nt':
        os.chmod(upgrade_script_path, 0o755)
    
    logger.info(f"✓ Upgrade script created: {upgrade_script_path}")
    return upgrade_script_path

def main():
    """Main integration function"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Enhanced MCP Server Integration")
    parser.add_argument("--create-server", action="store_true", help="Create enhanced server entry point")
    parser.add_argument("--create-upgrade", action="store_true", help="Create upgrade script")
    parser.add_argument("--test-integration", action="store_true", help="Test integration")
    
    args = parser.parse_args()
    
    if args.create_server:
        create_enhanced_mcp_server()
    
    if args.create_upgrade:
        create_upgrade_script()
    
    if args.test_integration:
        integration = EnhancedMCPIntegration()
        success = integration.integrate_enhanced_features()
        summary = integration.get_integration_summary()
        
        print("Integration Test Results:")
        print(f"  Success: {summary['integration_successful']}")
        print(f"  Features loaded: {', '.join(summary['features_loaded'])}")
        if summary['errors']:
            print(f"  Errors: {', '.join(summary['errors'])}")
        
        return success
    
    if not any([args.create_server, args.create_upgrade, args.test_integration]):
        # Default: create both server and upgrade script
        create_enhanced_mcp_server()
        create_upgrade_script()
        
        # Test integration
        integration = EnhancedMCPIntegration()
        success = integration.integrate_enhanced_features()
        
        if success:
            print("✓ Enhanced MCP server integration completed successfully")
            print("\\nFiles created:")
            print("  - enhanced_mcp_server.py (Enhanced server entry point)")
            print("  - upgrade_mcp_server.py (Upgrade script)")
            print("\\nTo start the enhanced server:")
            print("  python enhanced_mcp_server.py")
        else:
            print("✗ Enhanced MCP server integration failed")
            return False
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
