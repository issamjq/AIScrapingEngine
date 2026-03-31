import { 
  Facebook,
  Music,
  Youtube,
  Twitter,
  ShoppingCart,
  Send
} from "lucide-react"

export const platformConnections = [
  {
    id: "meta",
    name: "Meta (Facebook & Instagram)",
    icon: Facebook,
    status: "connected",
    lastSync: "2 hours ago",
    permissions: ["Manage Pages", "Publish Content", "Read Analytics"]
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: Music,
    status: "connected",
    lastSync: "5 hours ago",
    permissions: ["Upload Videos", "Read Analytics", "Manage Account"]
  },
  {
    id: "youtube",
    name: "YouTube",
    icon: Youtube,
    status: "connected",
    lastSync: "1 day ago",
    permissions: ["Upload Videos", "Manage Channel", "Read Analytics"]
  },
  {
    id: "twitter",
    name: "Twitter/X",
    icon: Twitter,
    status: "pending",
    lastSync: "Never",
    permissions: ["Post Tweets", "Read Timeline", "Manage Profile"]
  },
  {
    id: "shopify",
    name: "Shopify",
    icon: ShoppingCart,
    status: "error",
    lastSync: "3 days ago",
    permissions: ["Read Products", "Manage Orders", "Access Analytics"]
  },
  {
    id: "omnisend",
    name: "Omnisend",
    icon: Send,
    status: "connected",
    lastSync: "30 minutes ago",
    permissions: ["Send Emails", "Manage Campaigns", "Read Reports"]
  }
]

export const teamMembers = [
  {
    id: "1",
    name: "John Doe",
    email: "john@company.com",
    role: "Admin",
    avatar: "/avatars/john.png",
    lastActive: "2 hours ago"
  },
  {
    id: "2",
    name: "Sarah Wilson",
    email: "sarah@company.com",
    role: "Editor",
    avatar: "/avatars/sarah.png",
    lastActive: "5 minutes ago"
  },
  {
    id: "3",
    name: "Mike Johnson",
    email: "mike@company.com",
    role: "Viewer",
    avatar: "/avatars/mike.png",
    lastActive: "1 day ago"
  }
]

export const rolePermissions = [
  {
    role: "Admin",
    color: "text-red-600",
    permissions: [
      "Full platform access",
      "Manage integrations",
      "Invite/remove users",
      "Billing management",
      "Delete account"
    ]
  },
  {
    role: "Editor",
    color: "text-blue-600",
    permissions: [
      "Create and edit content",
      "Schedule posts",
      "Access AI services",
      "View analytics",
      "Manage content library"
    ]
  },
  {
    role: "Viewer",
    color: "text-green-600",
    permissions: [
      "View content",
      "Access reports",
      "View scheduled posts",
      "Read-only access"
    ]
  }
]