# MCP Server with Directory Configuration

A production-ready MCP (Model Context Protocol) server with comprehensive directory configuration management for commercial use. Features user-friendly configuration, security controls, and audit logging.

## 🆕 New: Directory Configuration System

The MCP server now includes a powerful directory configuration system that allows users to easily control which folders the server can access without editing Claude Desktop configurations.

### Key Features
- **User-friendly Configuration**: JSON-based configuration in `~/.mcp/config.json`
- **CLI Management**: Easy command-line tools for configuration
- **Auto-reload**: Configuration changes are automatically detected and applied
- **Security Controls**: Prevents access to system directories and sensitive files
- **Audit Logging**: Tracks all directory access for security auditing
- **Git Integration**: Automatically respects `.gitignore` patterns
- **File Size Limits**: Configurable limits to prevent reading large files
- **Pattern Exclusions**: Flexible file and directory exclusion patterns

## 🚀 Quick Start

### 1. Setup Configuration
```bash
# Interactive setup
python setup_mcp_config.py

# Or manually add directories
python mcp_config_manager.py --add-dir /path/to/your/project
```

### 2. List Configured Directories
```bash
python mcp_config_manager.py --list-dirs
```

### 3. Start the Server
```bash
python official_mcp_server.py
```

### 4. Integration with Claude Desktop
Update your Claude Desktop configuration:
```json
{
  "mcpServers": {
    "cursor-context": {
      "command": "python",
      "args": ["official_mcp_server.py", "--config", "~/.mcp/config.json"]
    }
  }
}
```

## 📚 Documentation

- **[Directory Configuration Guide](MCP_DIRECTORY_CONFIGURATION_GUIDE.md)** - Complete guide to the configuration system
- **[API Documentation](API_DOCUMENTATION.md)** - MCP server API reference
- **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - Production deployment instructions

---

# MCP SaaS Dashboard

A complete user dashboard frontend for your SaaS MCP server business built with Next.js 14, TypeScript, and modern UI components.

## 🚀 Features

### Authentication & Security
- JWT-based authentication with auto-refresh
- Protected routes and middleware
- Password change functionality
- Two-factor authentication support
- Session management

### Dashboard & Analytics
- Real-time usage statistics and metrics
- Interactive charts and graphs using Recharts
- Usage quota tracking with alerts
- Performance monitoring
- Historical data visualization

### Subscription & Billing
- Stripe integration for payments
- Subscription management (upgrade, downgrade, cancel)
- Payment method management
- Invoice history and downloads
- Billing settings and preferences

### License Management
- License key generation and management
- Device tracking and management
- Usage limits and monitoring
- License activation/deactivation

### Downloads & Documentation
- MCP server downloads with version management
- SDK downloads (Python, JavaScript)
- Complete documentation system
- API reference and guides
- Support system with FAQ

### User Experience
- Responsive design for all devices
- Dark/light mode support
- Modern UI with Shadcn/ui components
- Loading states and error handling
- Toast notifications
- Accessible components

## 🛠️ Technology Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn/ui + Radix UI
- **State Management**: React Query (TanStack Query)
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts
- **Icons**: Lucide React
- **Payments**: Stripe Elements
- **Authentication**: JWT with refresh tokens

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── dashboard/         # Dashboard pages
│   ├── login/            # Authentication pages
│   ├── register/
│   └── globals.css       # Global styles
├── components/           # Reusable components
│   ├── ui/              # Base UI components
│   ├── auth/            # Authentication components
│   ├── dashboard/       # Dashboard-specific components
│   ├── billing/         # Billing components
│   ├── licenses/        # License management components
│   ├── analytics/       # Analytics components
│   ├── downloads/       # Download components
│   └── layout/          # Layout components
├── hooks/               # Custom React hooks
├── lib/                 # Utility functions and API client
└── types/               # TypeScript type definitions
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Stripe account (for payments)
- Backend API server

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd mcp-saas-dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env.local
   ```
   
   Update `.env.local` with your configuration:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3001
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_SECRET_KEY=sk_test_...
   JWT_SECRET=your_jwt_secret
   ```

4. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🔧 Configuration

### API Integration

The dashboard is configured to work with your existing MCP server backend. Update the API endpoints in `src/lib/api.ts` to match your backend routes.

### Stripe Integration

1. Set up your Stripe account and get your API keys
2. Configure webhook endpoints for subscription events
3. Update the Stripe configuration in your environment variables

### Authentication

The authentication system expects your backend to provide:
- JWT access tokens
- Refresh tokens
- User profile data
- Subscription information

## 📱 Pages & Features

### Authentication Pages
- `/login` - User login
- `/register` - User registration
- `/forgot-password` - Password reset

### Dashboard Pages
- `/dashboard` - Main dashboard with overview
- `/dashboard/settings` - Account settings and preferences
- `/dashboard/billing` - Subscription and payment management
- `/dashboard/licenses` - License key management
- `/dashboard/analytics` - Usage analytics and insights
- `/dashboard/downloads` - MCP server downloads
- `/dashboard/docs` - Documentation and guides
- `/dashboard/support` - Support and help

## 🎨 Customization

### Theming
The dashboard supports light/dark mode and can be customized by modifying the CSS variables in `src/app/globals.css`.

### Branding
Update the logo, colors, and branding in:
- `src/components/layout/header.tsx`
- `src/components/layout/sidebar.tsx`
- `tailwind.config.js`

### API Endpoints
Modify API endpoints in `src/lib/api.ts` to match your backend implementation.

## 🔒 Security Features

- CSRF protection
- Input validation and sanitization
- Secure API communication
- Error boundary components
- Protected routes
- JWT token management

## 📊 Analytics & Monitoring

- Real-time usage tracking
- Performance metrics
- Error monitoring
- User activity logs
- Subscription analytics

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push

### Other Platforms
The app can be deployed to any platform that supports Next.js:
- Netlify
- AWS Amplify
- Railway
- DigitalOcean App Platform

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Check the documentation in `/dashboard/docs`
- Contact support via `/dashboard/support`
- Open an issue on GitHub

## 🔄 Updates

This dashboard is designed to be easily maintainable and extensible. Regular updates will include:
- New features and improvements
- Security updates
- Performance optimizations
- UI/UX enhancements

---

Built with ❤️ for the MCP SaaS community