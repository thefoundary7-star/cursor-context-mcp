import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'
import { Subscription, Invoice, PaymentMethod } from '@/types'
import toast from 'react-hot-toast'

export function useSubscription() {
  const queryClient = useQueryClient()

  const {
    data: subscription,
    isLoading,
    error,
  } = useQuery<Subscription>({
    queryKey: ['subscription'],
    queryFn: apiClient.getSubscription,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  const createSubscriptionMutation = useMutation({
    mutationFn: ({ priceId }: { priceId: string }) =>
      apiClient.createSubscription(priceId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
      toast.success('Subscription created successfully')
      return data
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create subscription')
    },
  })

  const updateSubscriptionMutation = useMutation({
    mutationFn: ({
      subscriptionId,
      data,
    }: {
      subscriptionId: string
      data: any
    }) => apiClient.updateSubscription(subscriptionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
      toast.success('Subscription updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update subscription')
    },
  })

  const cancelSubscriptionMutation = useMutation({
    mutationFn: ({ subscriptionId }: { subscriptionId: string }) =>
      apiClient.cancelSubscription(subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
      toast.success('Subscription canceled successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to cancel subscription')
    },
  })

  return {
    subscription,
    isLoading,
    error,
    createSubscription: createSubscriptionMutation.mutate,
    updateSubscription: updateSubscriptionMutation.mutate,
    cancelSubscription: cancelSubscriptionMutation.mutate,
    isCreateLoading: createSubscriptionMutation.isPending,
    isUpdateLoading: updateSubscriptionMutation.isPending,
    isCancelLoading: cancelSubscriptionMutation.isPending,
  }
}

export function useInvoices() {
  const {
    data: invoices,
    isLoading,
    error,
  } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: apiClient.getInvoices,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  return {
    invoices,
    isLoading,
    error,
  }
}

export function usePaymentMethods() {
  const queryClient = useQueryClient()

  const {
    data: paymentMethods,
    isLoading,
    error,
  } = useQuery<PaymentMethod[]>({
    queryKey: ['payment-methods'],
    queryFn: apiClient.getPaymentMethods,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const createPaymentMethodMutation = useMutation({
    mutationFn: apiClient.createPaymentMethod,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] })
      toast.success('Payment method added successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add payment method')
    },
  })

  const deletePaymentMethodMutation = useMutation({
    mutationFn: ({ paymentMethodId }: { paymentMethodId: string }) =>
      apiClient.deletePaymentMethod(paymentMethodId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] })
      toast.success('Payment method removed successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to remove payment method')
    },
  })

  return {
    paymentMethods,
    isLoading,
    error,
    createPaymentMethod: createPaymentMethodMutation.mutate,
    deletePaymentMethod: deletePaymentMethodMutation.mutate,
    isCreateLoading: createPaymentMethodMutation.isPending,
    isDeleteLoading: deletePaymentMethodMutation.isPending,
  }
}
