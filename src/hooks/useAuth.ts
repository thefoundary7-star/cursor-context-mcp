import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api'
import { User } from '@/types'
import Cookies from 'js-cookie'
import toast from 'react-hot-toast'

export function useAuth() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const {
    data: user,
    isLoading,
    error,
  } = useQuery<User>({
    queryKey: ['user'],
    queryFn: apiClient.getProfile,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      apiClient.login(email, password),
    onSuccess: (data) => {
      const { accessToken, refreshToken, user } = data
      Cookies.set('auth_token', accessToken, { expires: 7 })
      Cookies.set('refresh_token', refreshToken, { expires: 30 })
      queryClient.setQueryData(['user'], user)
      toast.success('Welcome back!')
      router.push('/dashboard')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Login failed')
    },
  })

  const registerMutation = useMutation({
    mutationFn: (userData: {
      email: string
      password: string
      firstName: string
      lastName: string
    }) => apiClient.register(userData),
    onSuccess: (data) => {
      const { accessToken, refreshToken, user } = data
      Cookies.set('auth_token', accessToken, { expires: 7 })
      Cookies.set('refresh_token', refreshToken, { expires: 30 })
      queryClient.setQueryData(['user'], user)
      toast.success('Account created successfully!')
      router.push('/dashboard')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Registration failed')
    },
  })

  const logoutMutation = useMutation({
    mutationFn: apiClient.logout,
    onSuccess: () => {
      Cookies.remove('auth_token')
      Cookies.remove('refresh_token')
      queryClient.clear()
      toast.success('Logged out successfully')
      router.push('/login')
    },
    onError: () => {
      // Even if logout fails on server, clear local data
      Cookies.remove('auth_token')
      Cookies.remove('refresh_token')
      queryClient.clear()
      router.push('/login')
    },
  })

  const updateProfileMutation = useMutation({
    mutationFn: apiClient.updateProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(['user'], data)
      toast.success('Profile updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update profile')
    },
  })

  const changePasswordMutation = useMutation({
    mutationFn: apiClient.changePassword,
    onSuccess: () => {
      toast.success('Password changed successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to change password')
    },
  })

  const isAuthenticated = !!user && !error
  const isLoggedIn = !!Cookies.get('auth_token')

  return {
    user,
    isLoading,
    isAuthenticated,
    isLoggedIn,
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    logout: logoutMutation.mutate,
    updateProfile: updateProfileMutation.mutate,
    changePassword: changePasswordMutation.mutate,
    isLoginLoading: loginMutation.isPending,
    isRegisterLoading: registerMutation.isPending,
    isLogoutLoading: logoutMutation.isPending,
    isUpdateProfileLoading: updateProfileMutation.isPending,
    isChangePasswordLoading: changePasswordMutation.isPending,
  }
}
