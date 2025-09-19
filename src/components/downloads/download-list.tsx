'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Download, 
  Package, 
  FileText, 
  Code,
  Clock,
  CheckCircle,
  AlertTriangle
} from 'lucide-react'
import { formatBytes, formatDate } from '@/lib/utils'

interface DownloadFile {
  id: string
  name: string
  description: string
  version: string
  size: number
  type: 'server' | 'sdk' | 'documentation' | 'example'
  platform?: string
  downloadUrl: string
  createdAt: string
  isLatest: boolean
  checksum?: string
}

const mockDownloads: DownloadFile[] = [
  {
    id: '1',
    name: 'MCP Server',
    description: 'Main MCP server application',
    version: '2.1.0',
    size: 15923456, // 15.2 MB
    type: 'server',
    platform: 'All Platforms',
    downloadUrl: '/downloads/mcp-server-2.1.0.zip',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    isLatest: true,
    checksum: 'sha256:abc123...',
  },
  {
    id: '2',
    name: 'MCP Server',
    description: 'Main MCP server application',
    version: '2.0.5',
    size: 15234567,
    type: 'server',
    platform: 'All Platforms',
    downloadUrl: '/downloads/mcp-server-2.0.5.zip',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    isLatest: false,
  },
  {
    id: '3',
    name: 'Python SDK',
    description: 'Python SDK for MCP integration',
    version: '1.3.2',
    size: 2048576, // 2 MB
    type: 'sdk',
    platform: 'Python 3.8+',
    downloadUrl: '/downloads/mcp-python-sdk-1.3.2.tar.gz',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    isLatest: true,
  },
  {
    id: '4',
    name: 'JavaScript SDK',
    description: 'JavaScript/TypeScript SDK for MCP integration',
    version: '1.2.1',
    size: 1048576, // 1 MB
    type: 'sdk',
    platform: 'Node.js 16+',
    downloadUrl: '/downloads/mcp-js-sdk-1.2.1.tgz',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    isLatest: true,
  },
  {
    id: '5',
    name: 'Documentation',
    description: 'Complete API documentation and guides',
    version: '2.1.0',
    size: 5242880, // 5 MB
    type: 'documentation',
    downloadUrl: '/downloads/mcp-docs-2.1.0.pdf',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    isLatest: true,
  },
  {
    id: '6',
    name: 'Example Projects',
    description: 'Sample implementations and code examples',
    version: '2.1.0',
    size: 3145728, // 3 MB
    type: 'example',
    downloadUrl: '/downloads/mcp-examples-2.1.0.zip',
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    isLatest: true,
  },
]

const getTypeIcon = (type: DownloadFile['type']) => {
  switch (type) {
    case 'server':
      return Package
    case 'sdk':
      return Code
    case 'documentation':
      return FileText
    case 'example':
      return Code
    default:
      return Package
  }
}

const getTypeColor = (type: DownloadFile['type']) => {
  switch (type) {
    case 'server':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    case 'sdk':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    case 'documentation':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
    case 'example':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  }
}

export function DownloadList() {
  const [downloading, setDownloading] = useState<string | null>(null)

  const handleDownload = async (file: DownloadFile) => {
    setDownloading(file.id)
    try {
      // In a real app, you would trigger the actual download
      await new Promise(resolve => setTimeout(resolve, 1000))
      console.log('Downloading:', file.name)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Download className="h-5 w-5" />
          <span>All Downloads</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {mockDownloads.map((file) => {
            const TypeIcon = getTypeIcon(file.type)
            return (
              <div
                key={file.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center space-x-4">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <TypeIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium">{file.name}</h4>
                      <Badge variant="outline" className={getTypeColor(file.type)}>
                        {file.type}
                      </Badge>
                      {file.isLatest && (
                        <Badge variant="success">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Latest
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{file.description}</p>
                    <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-1">
                      <div className="flex items-center space-x-1">
                        <Package className="h-3 w-3" />
                        <span>v{file.version}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Download className="h-3 w-3" />
                        <span>{formatBytes(file.size)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(file.createdAt)}</span>
                      </div>
                      {file.platform && (
                        <span>{file.platform}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {file.checksum && (
                    <Button variant="outline" size="sm">
                      <AlertTriangle className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    onClick={() => handleDownload(file)}
                    disabled={downloading === file.id}
                  >
                    {downloading === file.id ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
