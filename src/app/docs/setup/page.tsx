import { CheckCircle, Download, ExternalLink, Terminal, FileText, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function SetupGuide() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-gray-900">
              FileBridge
            </Link>
            <Link href="/dashboard" className="text-sm text-blue-600 hover:text-blue-700">
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Header */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Setup FileBridge in 3 Minutes
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Follow these simple steps to connect Claude Desktop to your codebase with FileBridge.
          </p>
        </div>

        {/* Setup Steps */}
        <div className="space-y-12">
          {/* Step 1: Install */}
          <div className="flex items-start space-x-6">
            <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
              1
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <Download className="w-6 h-6 mr-3" />
                Install FileBridge
              </h2>
              
              <div className="bg-gray-50 rounded-lg p-6 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">Choose your installation method:</h3>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Python Installation */}
                  <div className="bg-white rounded-lg border p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Python (Recommended)</h4>
                    <div className="bg-gray-900 rounded p-3 mb-3">
                      <code className="text-green-400 text-sm">pip install filebridge-mcp</code>
                    </div>
                    <p className="text-sm text-gray-600">
                      Install via pip for the latest stable version
                    </p>
                  </div>

                  {/* Direct Download */}
                  <div className="bg-white rounded-lg border p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Direct Download</h4>
                    <Button variant="outline" className="w-full mb-3">
                      <Download className="w-4 h-4 mr-2" />
                      Download FileBridge
                    </Button>
                    <p className="text-sm text-gray-600">
                      Download the executable for your platform
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">System Requirements</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Python 3.8+ (for pip installation)</li>
                  <li>• Windows 10+, macOS 10.15+, or Linux</li>
                  <li>• Claude Desktop installed</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Step 2: Activate License */}
          <div className="flex items-start space-x-6">
            <div className="flex-shrink-0 w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
              2
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <Terminal className="w-6 h-6 mr-3" />
                Activate Your License
              </h2>
              
              <div className="bg-gray-50 rounded-lg p-6 mb-4">
                <p className="text-gray-700 mb-4">
                  Use your license key to activate FileBridge:
                </p>
                
                <div className="bg-gray-900 rounded-lg p-4">
                  <code className="text-green-400">
                    filebridge activate YOUR_LICENSE_KEY
                  </code>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg border p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Free Tier</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Your license key starts with: <code className="bg-gray-100 px-1 rounded">FILEBRIDGE-FREE-</code>
                  </p>
                  <div className="text-xs text-green-700 bg-green-50 rounded p-2">
                    50 MCP calls per day
                  </div>
                </div>

                <div className="bg-white rounded-lg border p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Pro/Enterprise</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Your license key starts with: <code className="bg-gray-100 px-1 rounded">FILEBRIDGE-</code>
                  </p>
                  <div className="text-xs text-purple-700 bg-purple-50 rounded p-2">
                    Unlimited MCP calls
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Configure */}
          <div className="flex items-start space-x-6">
            <div className="flex-shrink-0 w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
              3
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <FileText className="w-6 h-6 mr-3" />
                Configure Claude Desktop
              </h2>
              
              <div className="bg-gray-50 rounded-lg p-6 mb-4">
                <p className="text-gray-700 mb-4">
                  Add FileBridge to your Claude Desktop configuration:
                </p>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">1. Open Claude Desktop Settings</h4>
                    <p className="text-sm text-gray-600">
                      Click the gear icon in Claude Desktop, then go to "MCP Servers"
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">2. Add FileBridge Server</h4>
                    <div className="bg-gray-900 rounded-lg p-4">
                      <pre className="text-green-400 text-sm overflow-x-auto">
{`{
  "mcpServers": {
    "filebridge": {
      "command": "filebridge",
      "args": ["serve"],
      "env": {
        "FILEBRIDGE_PROJECT": "/path/to/your/project"
      }
    }
  }
}`}
                      </pre>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">3. Restart Claude Desktop</h4>
                    <p className="text-sm text-gray-600">
                      Close and reopen Claude Desktop to load the FileBridge MCP server
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-900 mb-2">Quick Configuration</h4>
                <p className="text-yellow-800 text-sm mb-3">
                  FileBridge can automatically configure Claude Desktop for you:
                </p>
                <div className="bg-gray-900 rounded p-3">
                  <code className="text-green-400 text-sm">filebridge setup --auto</code>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Verification */}
        <div className="mt-16 bg-green-50 border border-green-200 rounded-2xl p-8">
          <div className="text-center">
            <Zap className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Test Your Setup
            </h2>
            <p className="text-gray-700 mb-6 max-w-2xl mx-auto">
              Once configured, open Claude Desktop and try asking: "Can you help me review the files in my project?"
              FileBridge should provide context-aware responses about your codebase.
            </p>
            
            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              <div className="bg-white rounded-lg p-6 border border-green-200">
                <h3 className="font-semibold text-gray-900 mb-3">✅ Working Correctly</h3>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li>• Claude can list your project files</li>
                  <li>• File contents are accessible</li>
                  <li>• Git status is available</li>
                  <li>• Usage tracking is active</li>
                </ul>
              </div>
              
              <div className="bg-white rounded-lg p-6 border border-green-200">
                <h3 className="font-semibold text-gray-900 mb-3">❌ Need Help?</h3>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li>• Check license activation status</li>
                  <li>• Verify Claude Desktop configuration</li>
                  <li>• Review project path settings</li>
                  <li>• Contact support if needed</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="mt-12 text-center space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">You're All Set!</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            FileBridge is now connected to Claude Desktop. Start experiencing AI assistance with full project context.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild>
              <Link href="/dashboard">
                <Terminal className="w-4 h-4 mr-2" />
                View Dashboard
              </Link>
            </Button>
            
            <Button variant="outline" asChild>
              <Link href="/docs">
                <FileText className="w-4 h-4 mr-2" />
                Browse Documentation
              </Link>
            </Button>
            
            <Button variant="outline" asChild>
              <Link href="mailto:support@filebridge.dev">
                Get Support
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
