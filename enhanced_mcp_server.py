#!/usr/bin/env python3
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
