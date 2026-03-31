import { useState, useEffect } from "react"
import { PageSkeleton } from "./PageSkeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { Settings } from "lucide-react"
import { IntegrationsTab } from "./settings/IntegrationsTab"
import { TeamTab } from "./settings/TeamTab"
import { BillingTab } from "./settings/BillingTab"
import { NotificationsTab } from "./settings/NotificationsTab"
import { AccountTab } from "./settings/AccountTab"

export function SettingsContent() {
  const [loading, setLoading] = useState(true)
  useEffect(() => { const t = setTimeout(() => setLoading(false), 600); return () => clearTimeout(t) }, [])

  const [showApiKeys, setShowApiKeys] = useState(false)
  const [emailDigest, setEmailDigest] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(true)
  const [marketingEmails, setMarketingEmails] = useState(false)

  if (loading) return <PageSkeleton cards={2} rows={4} />

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Settings & Accounts</h1>
            <p className="text-muted-foreground">Manage your integrations, team, and account preferences</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="integrations" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="space-y-6">
          <IntegrationsTab />
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          <TeamTab />
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          <BillingTab />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <NotificationsTab
            emailDigest={emailDigest}
            setEmailDigest={setEmailDigest}
            pushNotifications={pushNotifications}
            setPushNotifications={setPushNotifications}
            marketingEmails={marketingEmails}
            setMarketingEmails={setMarketingEmails}
          />
        </TabsContent>

        <TabsContent value="account" className="space-y-6">
          <AccountTab
            showApiKeys={showApiKeys}
            setShowApiKeys={setShowApiKeys}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}