import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Switch } from "../ui/switch"
import { Bell, Mail, Smartphone } from "lucide-react"

interface NotificationsTabProps {
  emailDigest: boolean
  setEmailDigest: (value: boolean) => void
  pushNotifications: boolean
  setPushNotifications: (value: boolean) => void
  marketingEmails: boolean
  setMarketingEmails: (value: boolean) => void
}

export function NotificationsTab({
  emailDigest,
  setEmailDigest,
  pushNotifications,
  setPushNotifications,
  marketingEmails,
  setMarketingEmails
}: NotificationsTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>Choose how you want to be notified about important updates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Push notifications</p>
                <p className="text-sm text-muted-foreground">Get notified about campaign performance and updates</p>
              </div>
              <Switch 
                checked={pushNotifications}
                onCheckedChange={setPushNotifications}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Email digest</p>
                <p className="text-sm text-muted-foreground">Weekly summary of your account activity</p>
              </div>
              <Switch 
                checked={emailDigest}
                onCheckedChange={setEmailDigest}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Marketing emails</p>
                <p className="text-sm text-muted-foreground">Product updates, tips, and promotional content</p>
              </div>
              <Switch 
                checked={marketingEmails}
                onCheckedChange={setMarketingEmails}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Campaign alerts</p>
                <p className="text-sm text-muted-foreground">Immediate alerts for campaign issues or completions</p>
              </div>
              <Switch defaultChecked />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Credit usage warnings</p>
                <p className="text-sm text-muted-foreground">Alert when you're running low on credits</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Channels</CardTitle>
          <CardDescription>Configure how notifications are delivered</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-3 border rounded-lg">
            <Mail className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="font-medium">Email</p>
              <p className="text-sm text-muted-foreground">john@company.com</p>
            </div>
            <Switch defaultChecked />
          </div>
          
          <div className="flex items-center gap-4 p-3 border rounded-lg">
            <Smartphone className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="font-medium">Mobile Push</p>
              <p className="text-sm text-muted-foreground">Via mobile app notifications</p>
            </div>
            <Switch defaultChecked />
          </div>
          
          <div className="flex items-center gap-4 p-3 border rounded-lg">
            <Bell className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="font-medium">In-App</p>
              <p className="text-sm text-muted-foreground">Notifications within the platform</p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}