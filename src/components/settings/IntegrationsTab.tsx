import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog"
import { CheckCircle } from "lucide-react"
import { platformConnections } from "./settingsData"
import { getStatusIcon, getStatusColor, getIconColor } from "./settingsUtils"

export function IntegrationsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform Integrations</CardTitle>
        <CardDescription>Connect and manage your social media and marketing platforms</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {platformConnections.map((platform) => {
          const PlatformIcon = platform.icon
          const StatusIcon = getStatusIcon(platform.status)
          
          return (
            <div key={platform.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-muted">
                  <PlatformIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-medium">{platform.name}</h4>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <StatusIcon className={`w-4 h-4 ${getIconColor(platform.status)}`} />
                    <span>Last sync: {platform.lastSync}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Badge className={getStatusColor(platform.status)}>
                  {platform.status}
                </Badge>
                
                {platform.status === "connected" ? (
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          View Permissions
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{platform.name} Permissions</DialogTitle>
                          <DialogDescription>
                            Current permissions granted to AI Marketing Platform
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3">
                          {platform.permissions.map((permission, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500" />
                              <span className="text-sm">{permission}</span>
                            </div>
                          ))}
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button variant="outline" size="sm">
                      Disconnect
                    </Button>
                  </div>
                ) : platform.status === "error" ? (
                  <Button size="sm">
                    Reconnect
                  </Button>
                ) : (
                  <Button size="sm">
                    Connect
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}