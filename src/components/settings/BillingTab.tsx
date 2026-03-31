import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { Progress } from "../ui/progress"
import { CreditCard, Zap, TrendingUp } from "lucide-react"

export function BillingTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Credit Usage</CardTitle>
          <CardDescription>Monitor your AI credit consumption and usage patterns</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold">2,500 Credits Remaining</h3>
                <p className="text-sm text-muted-foreground">Out of 5,000 monthly credits</p>
              </div>
            </div>
            <Badge variant="secondary">50% Used</Badge>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Monthly Usage</span>
              <span>2,500 / 5,000 credits</span>
            </div>
            <Progress value={50} className="h-3" />
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="font-semibold">1,847</div>
              <div className="text-xs text-muted-foreground">Content Generation</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="font-semibold">456</div>
              <div className="text-xs text-muted-foreground">Image Creation</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="font-semibold">197</div>
              <div className="text-xs text-muted-foreground">Video Scripts</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing Information</CardTitle>
          <CardDescription>Manage your subscription and billing preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-muted-foreground" />
              <div>
                <h4 className="font-medium">Pro Plan</h4>
                <p className="text-sm text-muted-foreground">$49/month • Next billing: Feb 1, 2025</p>
              </div>
            </div>
            <Badge>Active</Badge>
          </div>

          <div className="flex gap-2">
            <Button>
              <TrendingUp className="w-4 h-4 mr-2" />
              Upgrade Plan
            </Button>
            <Button variant="outline">Update Payment</Button>
            <Button variant="outline">View Invoices</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top-up Credits</CardTitle>
          <CardDescription>Purchase additional credits as needed</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { credits: "1,000", price: "$10", popular: false },
              { credits: "5,000", price: "$40", popular: true },
              { credits: "10,000", price: "$70", popular: false }
            ].map((pack, index) => (
              <div key={index} className={`p-4 border rounded-lg relative ${pack.popular ? 'ring-2 ring-primary' : ''}`}>
                {pack.popular && (
                  <Badge className="absolute -top-2 left-4">Most Popular</Badge>
                )}
                <div className="text-center space-y-2">
                  <h4 className="font-semibold">{pack.credits} Credits</h4>
                  <p className="text-2xl font-bold">{pack.price}</p>
                  <Button className="w-full" variant={pack.popular ? "default" : "outline"}>
                    Purchase
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}