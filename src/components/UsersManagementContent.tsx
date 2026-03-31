import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Users, Plus, Shield } from "lucide-react"
import { TableSkeleton } from "./PageSkeleton"

const ROLE_LABELS: Record<string, string> = {
  "001": "Dev",
  "003": "Super Admin",
  "004": "Admin",
  "008": "User",
}

const mockUsers = [
  { id: 1, email: "dev@example.com",        name: "Developer",   role: "001", is_active: true },
  { id: 2, email: "admin@example.com",      name: "Admin User",  role: "004", is_active: true },
  { id: 3, email: "reader@example.com",     name: "Reader",      role: "008", is_active: true },
  { id: 4, email: "inactive@example.com",   name: "Inactive",    role: "008", is_active: false },
]

export function UsersManagementContent() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 900)
    return () => clearTimeout(t)
  }, [])

  if (loading) return <TableSkeleton rows={5} />

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage who has access to this application.
          </p>
        </div>
        <Button size="sm" className="gap-1.5 shrink-0">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add User</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2">
        {[
          { label: "Total Users",  value: String(mockUsers.length) },
          { label: "Active Users", value: String(mockUsers.filter(u => u.is_active).length) },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
              <CardTitle className="text-xs sm:text-sm font-medium">{label}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl sm:text-2xl font-bold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* User table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Allowed Users
          </CardTitle>
          <CardDescription className="text-xs">
            Only listed users can access this application after Google sign-in.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Email</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Role</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mockUsers.map((user) => (
                  <tr key={user.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{user.name}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden sm:table-cell">{user.email}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline" className="text-[10px]">
                        {ROLE_LABELS[user.role] ?? user.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant={user.is_active ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {user.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" className="h-7 text-xs px-2">
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
