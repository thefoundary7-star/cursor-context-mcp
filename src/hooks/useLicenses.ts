import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'
import { License, Device } from '@/types'
import toast from 'react-hot-toast'

export function useLicenses() {
  const queryClient = useQueryClient()

  const {
    data: licenses,
    isLoading,
    error,
  } = useQuery<License[]>({
    queryKey: ['licenses'],
    queryFn: apiClient.getLicenses,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  const createLicenseMutation = useMutation({
    mutationFn: ({ name, deviceLimit }: { name: string; deviceLimit: number }) =>
      apiClient.createLicense({ name, deviceLimit }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] })
      toast.success('License created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create license')
    },
  })

  const updateLicenseMutation = useMutation({
    mutationFn: ({ licenseId, data }: { licenseId: string; data: any }) =>
      apiClient.updateLicense(licenseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] })
      toast.success('License updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update license')
    },
  })

  const deleteLicenseMutation = useMutation({
    mutationFn: ({ licenseId }: { licenseId: string }) =>
      apiClient.deleteLicense(licenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] })
      toast.success('License deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete license')
    },
  })

  return {
    licenses,
    isLoading,
    error,
    createLicense: createLicenseMutation.mutate,
    updateLicense: updateLicenseMutation.mutate,
    deleteLicense: deleteLicenseMutation.mutate,
    isCreateLoading: createLicenseMutation.isPending,
    isUpdateLoading: updateLicenseMutation.isPending,
    isDeleteLoading: deleteLicenseMutation.isPending,
  }
}

export function useDevices(licenseId: string) {
  const queryClient = useQueryClient()

  const {
    data: devices,
    isLoading,
    error,
  } = useQuery<Device[]>({
    queryKey: ['devices', licenseId],
    queryFn: () => apiClient.getDevices(licenseId),
    enabled: !!licenseId,
    staleTime: 1 * 60 * 1000, // 1 minute
  })

  const addDeviceMutation = useMutation({
    mutationFn: ({ name, deviceId }: { name: string; deviceId: string }) =>
      apiClient.addDevice(licenseId, { name, deviceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices', licenseId] })
      queryClient.invalidateQueries({ queryKey: ['licenses'] })
      toast.success('Device added successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add device')
    },
  })

  const removeDeviceMutation = useMutation({
    mutationFn: ({ deviceId }: { deviceId: string }) =>
      apiClient.removeDevice(licenseId, deviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices', licenseId] })
      queryClient.invalidateQueries({ queryKey: ['licenses'] })
      toast.success('Device removed successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to remove device')
    },
  })

  return {
    devices,
    isLoading,
    error,
    addDevice: addDeviceMutation.mutate,
    removeDevice: removeDeviceMutation.mutate,
    isAddLoading: addDeviceMutation.isPending,
    isRemoveLoading: removeDeviceMutation.isPending,
  }
}
