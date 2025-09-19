'use client'

import { useState } from 'react'
import { useLicenses } from '@/hooks/useLicenses'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { 
  Key, 
  Server, 
  MoreHorizontal, 
  Copy, 
  Trash2, 
  Edit,
  Eye,
  Shield,
  AlertTriangle
} from 'lucide-react'
import { formatDate, generateLicenseKey } from '@/lib/utils'
import { License } from '@/types'

export function LicenseList() {
  const { licenses, isLoading, deleteLicense, isDeleteLoading } = useLicenses()
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null)
  const [showDeviceDialog, setShowDeviceDialog] = useState(false)

  const handleDelete = (licenseId: string) => {
    if (confirm('Are you sure you want to delete this license? This action cannot be undone.')) {
      deleteLicense({ licenseId })
    }
  }

  const copyLicenseKey = (key: string) => {
    navigator.clipboard.writeText(key)
    // You could add a toast notification here
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 w-32 bg-muted rounded animate-pulse"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded animate-pulse"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Key className="h-5 w-5" />
            <span>Your Licenses</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {licenses && licenses.length > 0 ? (
            <div className="space-y-4">
              {licenses.map((license) => (
                <div
                  key={license.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Key className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium">{license.name}</h4>
                        <Badge variant={license.isActive ? 'success' : 'secondary'}>
                          {license.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <Server className="h-3 w-3" />
                          <span>{license.devices.length} / {license.deviceLimit} devices</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Shield className="h-3 w-3" />
                          <span>Created {formatDate(license.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {license.key}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyLicenseKey(license.key)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedLicense(license)
                        setShowDeviceDialog(true)
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View Devices
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(license.id)}
                      disabled={isDeleteLoading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Licenses</h3>
              <p className="text-muted-foreground mb-4">
                Create your first license key to start using the MCP server.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Device Dialog */}
      <Dialog open={showDeviceDialog} onOpenChange={setShowDeviceDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Server className="h-5 w-5" />
              <span>Devices for {selectedLicense?.name}</span>
            </DialogTitle>
            <DialogDescription>
              Manage devices connected to this license key.
            </DialogDescription>
          </DialogHeader>
          {selectedLicense && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {selectedLicense.devices.length} of {selectedLicense.deviceLimit} devices used
                  </p>
                </div>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Device
                </Button>
              </div>
              
              <div className="space-y-2">
                {selectedLicense.devices.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <Server className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <h4 className="font-medium">{device.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {device.deviceId} • Last seen {formatDate(device.lastSeen)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={device.isActive ? 'success' : 'secondary'}>
                        {device.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <Button variant="outline" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
