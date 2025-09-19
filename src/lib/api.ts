import axios, { AxiosInstance, AxiosResponse } from 'axios'
import Cookies from 'js-cookie'
import toast from 'react-hot-toast'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.setupInterceptors()
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = Cookies.get('auth_token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // Response interceptor to handle errors and token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true

          try {
            const refreshToken = Cookies.get('refresh_token')
            if (refreshToken) {
              const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                refreshToken,
              })

              const { accessToken } = response.data
              Cookies.set('auth_token', accessToken, { expires: 7 })
              
              originalRequest.headers.Authorization = `Bearer ${accessToken}`
              return this.client(originalRequest)
            }
          } catch (refreshError) {
            // Refresh failed, redirect to login
            this.handleAuthError()
            return Promise.reject(refreshError)
          }
        }

        // Handle other errors
        if (error.response?.status >= 500) {
          toast.error('Server error. Please try again later.')
        } else if (error.response?.status === 404) {
          toast.error('Resource not found.')
        } else if (error.response?.status === 403) {
          toast.error('Access denied.')
        }

        return Promise.reject(error)
      }
    )
  }

  private handleAuthError() {
    Cookies.remove('auth_token')
    Cookies.remove('refresh_token')
    window.location.href = '/login'
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password })
    return response.data
  }

  async register(userData: {
    email: string
    password: string
    firstName: string
    lastName: string
  }) {
    const response = await this.client.post('/auth/register', userData)
    return response.data
  }

  async logout() {
    await this.client.post('/auth/logout')
    Cookies.remove('auth_token')
    Cookies.remove('refresh_token')
  }

  async refreshToken(refreshToken: string) {
    const response = await this.client.post('/auth/refresh', { refreshToken })
    return response.data
  }

  // User endpoints
  async getProfile() {
    const response = await this.client.get('/user/profile')
    return response.data
  }

  async updateProfile(data: any) {
    const response = await this.client.put('/user/profile', data)
    return response.data
  }

  async changePassword(data: { currentPassword: string; newPassword: string }) {
    const response = await this.client.put('/user/change-password', data)
    return response.data
  }

  // Subscription endpoints
  async getSubscription() {
    const response = await this.client.get('/billing/subscription')
    return response.data
  }

  async createSubscription(priceId: string) {
    const response = await this.client.post('/billing/subscription', { priceId })
    return response.data
  }

  async updateSubscription(subscriptionId: string, data: any) {
    const response = await this.client.put(`/billing/subscription/${subscriptionId}`, data)
    return response.data
  }

  async cancelSubscription(subscriptionId: string) {
    const response = await this.client.delete(`/billing/subscription/${subscriptionId}`)
    return response.data
  }

  async getInvoices() {
    const response = await this.client.get('/billing/invoices')
    return response.data
  }

  async getPaymentMethods() {
    const response = await this.client.get('/billing/payment-methods')
    return response.data
  }

  async createPaymentMethod(data: any) {
    const response = await this.client.post('/billing/payment-methods', data)
    return response.data
  }

  async deletePaymentMethod(paymentMethodId: string) {
    const response = await this.client.delete(`/billing/payment-methods/${paymentMethodId}`)
    return response.data
  }

  // License endpoints
  async getLicenses() {
    const response = await this.client.get('/licenses')
    return response.data
  }

  async createLicense(data: { name: string; deviceLimit: number }) {
    const response = await this.client.post('/licenses', data)
    return response.data
  }

  async updateLicense(licenseId: string, data: any) {
    const response = await this.client.put(`/licenses/${licenseId}`, data)
    return response.data
  }

  async deleteLicense(licenseId: string) {
    const response = await this.client.delete(`/licenses/${licenseId}`)
    return response.data
  }

  async getDevices(licenseId: string) {
    const response = await this.client.get(`/licenses/${licenseId}/devices`)
    return response.data
  }

  async addDevice(licenseId: string, data: { name: string; deviceId: string }) {
    const response = await this.client.post(`/licenses/${licenseId}/devices`, data)
    return response.data
  }

  async removeDevice(licenseId: string, deviceId: string) {
    const response = await this.client.delete(`/licenses/${licenseId}/devices/${deviceId}`)
    return response.data
  }

  // Analytics endpoints
  async getUsageStats(timeRange: string = '30d') {
    const response = await this.client.get(`/analytics/usage?range=${timeRange}`)
    return response.data
  }

  async getUsageHistory(timeRange: string = '30d') {
    const response = await this.client.get(`/analytics/usage/history?range=${timeRange}`)
    return response.data
  }

  // Download endpoints
  async getDownloads() {
    const response = await this.client.get('/downloads')
    return response.data
  }

  async downloadFile(fileId: string) {
    const response = await this.client.get(`/downloads/${fileId}`, {
      responseType: 'blob',
    })
    return response.data
  }
}

export const apiClient = new ApiClient()
export default apiClient
