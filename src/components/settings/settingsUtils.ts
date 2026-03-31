import { CheckCircle, AlertCircle, XCircle, Clock } from "lucide-react"

export const getStatusIcon = (status: string) => {
  switch (status) {
    case "connected":
      return CheckCircle
    case "pending":
      return Clock
    case "error":
      return XCircle
    default:
      return AlertCircle
  }
}

export const getStatusColor = (status: string) => {
  switch (status) {
    case "connected":
      return "text-green-600 bg-green-50"
    case "pending":
      return "text-yellow-600 bg-yellow-50"
    case "error":
      return "text-red-600 bg-red-50"
    default:
      return "text-gray-600 bg-gray-50"
  }
}

export const getIconColor = (status: string) => {
  switch (status) {
    case "connected":
      return "text-green-500"
    case "pending":
      return "text-yellow-500"
    case "error":
      return "text-red-500"
    default:
      return "text-gray-500"
  }
}