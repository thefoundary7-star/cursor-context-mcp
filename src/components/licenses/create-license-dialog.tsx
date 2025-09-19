'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useLicenses } from '@/hooks/useLicenses'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Loader2, Plus, Key } from 'lucide-react'

const createLicenseSchema = z.object({
  name: z.string().min(2, 'License name must be at least 2 characters'),
  deviceLimit: z.number().min(1, 'Device limit must be at least 1').max(100, 'Device limit cannot exceed 100'),
})

type CreateLicenseFormData = z.infer<typeof createLicenseSchema>

export function CreateLicenseDialog() {
  const [open, setOpen] = useState(false)
  const { createLicense, isCreateLoading } = useLicenses()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateLicenseFormData>({
    resolver: zodResolver(createLicenseSchema),
    defaultValues: {
      deviceLimit: 5,
    },
  })

  const onSubmit = (data: CreateLicenseFormData) => {
    createLicense(data)
    reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create License
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Key className="h-5 w-5" />
            <span>Create New License</span>
          </DialogTitle>
          <DialogDescription>
            Create a new license key for your MCP server. You can manage devices and usage limits after creation.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">License Name</Label>
            <Input
              id="name"
              placeholder="e.g., Production Server, Development Environment"
              {...register('name')}
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="deviceLimit">Device Limit</Label>
            <Input
              id="deviceLimit"
              type="number"
              min="1"
              max="100"
              {...register('deviceLimit', { valueAsNumber: true })}
              className={errors.deviceLimit ? 'border-destructive' : ''}
            />
            {errors.deviceLimit && (
              <p className="text-sm text-destructive">{errors.deviceLimit.message}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Maximum number of devices that can use this license key.
            </p>
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreateLoading}>
              {isCreateLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create License'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
