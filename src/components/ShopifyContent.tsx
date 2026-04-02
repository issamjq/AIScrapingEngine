import { useState, useEffect } from "react"
import { PageSkeleton } from "./PageSkeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Textarea } from "./ui/textarea"
import { Switch } from "./ui/switch"
import { Progress } from "./ui/progress"
import { Input } from "./ui/input"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { ImageWithFallback } from "./figma/ImageWithFallback"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts"
import { 
  ShoppingCart,
  CheckCircle,
  AlertCircle,
  Calendar,
  TrendingUp,
  Users,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  DollarSign,
  Package,
  Clock,
  Sparkles,
  BarChart3,
  Zap,
  Star,
  Tag
} from "lucide-react"

const shopifyPerformanceData = [
  { date: "Jan 1", sales: 2500, orders: 24, visitors: 450, conversion: 5.3 },
  { date: "Jan 2", sales: 3200, orders: 31, visitors: 520, conversion: 6.0 },
  { date: "Jan 3", sales: 1800, orders: 19, visitors: 380, conversion: 5.0 },
  { date: "Jan 4", sales: 4100, orders: 38, visitors: 620, conversion: 6.1 },
  { date: "Jan 5", sales: 3600, orders: 34, visitors: 580, conversion: 5.9 },
  { date: "Jan 6", sales: 2900, orders: 28, visitors: 490, conversion: 5.7 },
  { date: "Jan 7", sales: 4500, orders: 42, visitors: 680, conversion: 6.2 }
]

const topProducts = [
  { name: "Wireless Headphones", sales: 156, revenue: 15600, growth: "+23%" },
  { name: "Smart Watch", sales: 124, revenue: 24800, growth: "+18%" },
  { name: "Phone Case", sales: 89, revenue: 2670, growth: "+12%" },
  { name: "Laptop Stand", sales: 67, revenue: 6700, growth: "+8%" },
  { name: "USB Cable", sales: 234, revenue: 4680, growth: "+45%" }
]

export function ShopifyContent(_: { role?: string }) {
  const [loading, setLoading] = useState(true)
  useEffect(() => { const t = setTimeout(() => setLoading(false), 800); return () => clearTimeout(t) }, [])

  const [productDescription, setProductDescription] = useState("")
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false)
  const [oAuthConnected, setOAuthConnected] = useState(true)
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true)

  const handleGenerateDescription = () => {
    setIsGeneratingDescription(true)
    setTimeout(() => {
      setProductDescription("🎧 Experience Premium Sound Quality\n\nTransform your audio experience with our cutting-edge wireless headphones. Featuring advanced noise cancellation, 30-hour battery life, and crystal-clear sound quality that brings your music to life.\n\n✨ Key Features:\n• Active Noise Cancellation - Block out distractions\n• 30-Hour Battery Life - All-day listening\n• Premium Materials - Comfortable and durable\n• Quick Charge - 15 minutes = 3 hours playback\n• Universal Compatibility - Works with all devices\n\n🚚 Free shipping on orders over $50\n💫 30-day money-back guarantee\n⭐ Join thousands of satisfied customers\n\nOrder now and elevate your audio experience!")
      setIsGeneratingDescription(false)
    }, 2500)
  }

  if (loading) return <PageSkeleton cards={3} rows={3} />

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-50 text-green-600">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Shopify Marketing</h1>
            <p className="text-muted-foreground">Boost your e-commerce sales with AI-powered content</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {oAuthConnected ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium">Store Connected</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium">Store Disconnected</span>
              </>
            )}
          </div>
          <Button variant="outline">Reconnect Store</Button>
        </div>
      </div>

      <Tabs defaultValue="scheduler" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="scheduler">Product Marketing</TabsTrigger>
          <TabsTrigger value="performance">Sales Analytics</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Product Marketing Tab */}
        <TabsContent value="scheduler" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* AI Product Description Generator */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  AI Product Description Generator
                </CardTitle>
                <CardDescription>Create compelling product descriptions that convert</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Product Name</label>
                  <Input placeholder="Enter product name..." />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    placeholder="Enter product details or let AI generate a compelling description..."
                    value={productDescription}
                    onChange={(e) => setProductDescription(e.target.value)}
                    className="min-h-[150px]"
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={handleGenerateDescription}
                    disabled={isGeneratingDescription}
                    className="flex-1"
                  >
                    {isGeneratingDescription ? (
                      <>
                        <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Generate Description
                      </>
                    )}
                  </Button>
                  
                  <Select>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Style" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="persuasive">Persuasive</SelectItem>
                      <SelectItem value="informative">Informative</SelectItem>
                      <SelectItem value="luxury">Luxury</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">SEO optimize</label>
                    <Switch defaultChecked />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Include benefits</label>
                    <Switch defaultChecked />
                  </div>
                </div>

                <Button className="w-full">
                  <Package className="w-4 h-4 mr-2" />
                  Update Product
                </Button>
              </CardContent>
            </Card>

            {/* Today's Store Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Today's Store Performance</CardTitle>
                <CardDescription>Real-time metrics from your Shopify store</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <DollarSign className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">$4,500</div>
                    <div className="text-xs text-muted-foreground">Sales</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <Package className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">42</div>
                    <div className="text-xs text-muted-foreground">Orders</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <Eye className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">680</div>
                    <div className="text-xs text-muted-foreground">Visitors</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <TrendingUp className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">6.2%</div>
                    <div className="text-xs text-muted-foreground">Conversion</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Average Order Value</span>
                    <span>$107.14</span>
                  </div>
                  <Progress value={72} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Cart Abandonment</span>
                    <span>68%</span>
                  </div>
                  <Progress value={68} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Return Rate</span>
                    <span>2.1%</span>
                  </div>
                  <Progress value={21} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Performing Products */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5" />
                Top Performing Products
              </CardTitle>
              <CardDescription>Your best-selling products this week</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topProducts.map((product, index) => (
                  <div key={index} className="flex items-center gap-4 p-3 border rounded-lg">
                    <ImageWithFallback 
                      src={`https://images.unsplash.com/photo-${1500000000000 + index * 1000}?w=60&h=60&fit=crop`}
                      alt={product.name}
                      className="w-12 h-12 object-cover rounded-lg"
                    />
                    <div className="flex-1">
                      <h4 className="font-medium">{product.name}</h4>
                      <div className="flex gap-3 text-sm text-muted-foreground">
                        <span>{product.sales} sold</span>
                        <span>${product.revenue.toLocaleString()}</span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-green-600">
                      {product.growth}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sales Analytics Tab */}
        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sales Performance</CardTitle>
              <CardDescription>Last 7 days of store analytics</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={shopifyPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={2} />
                  <Line type="monotone" dataKey="visitors" stroke="#3b82f6" strokeWidth={2} />
                  <Line type="monotone" dataKey="orders" stroke="#f59e0b" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Sales by Category</CardTitle>
                <CardDescription>Revenue breakdown by product category</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Electronics", value: 45, color: "#3b82f6" },
                        { name: "Accessories", value: 30, color: "#10b981" },
                        { name: "Clothing", value: 15, color: "#f59e0b" },
                        { name: "Home & Garden", value: 10, color: "#ef4444" }
                      ]}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}%`}
                    >
                      {[
                        { name: "Electronics", value: 45, color: "#3b82f6" },
                        { name: "Accessories", value: 30, color: "#10b981" },
                        { name: "Clothing", value: 15, color: "#f59e0b" },
                        { name: "Home & Garden", value: 10, color: "#ef4444" }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Customer Acquisition</CardTitle>
                <CardDescription>Traffic sources and conversion rates</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={[
                    { id: 1, source: "Organic", visitors: 280, conversions: 18 },
                    { id: 2, source: "Social", visitors: 190, conversions: 12 },
                    { id: 3, source: "Email", visitors: 120, conversions: 15 },
                    { id: 4, source: "Paid", visitors: 90, conversions: 8 }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="source" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="visitors" fill="#3b82f6" />
                    <Bar dataKey="conversions" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* AI Insights Tab */}
        <TabsContent value="insights" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Weekly Shopify Insights
              </CardTitle>
              <CardDescription>AI-powered recommendations to boost your sales</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-green-600 mb-2">🚀 Sales Surge Detected</h4>
                  <p className="text-sm text-muted-foreground">Your electronics category is trending up 35%. Consider running targeted ads for wireless headphones and smart watches.</p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-blue-600 mb-2">🛒 Cart Recovery Opportunity</h4>
                  <p className="text-sm text-muted-foreground">68% cart abandonment rate detected. Automated email sequences could recover 15-20% of lost sales.</p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-purple-600 mb-2">📱 Mobile Optimization</h4>
                  <p className="text-sm text-muted-foreground">72% of traffic is mobile, but conversion is 40% lower. Optimize checkout flow for mobile users.</p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-orange-600 mb-2">⭐ Review Leverage</h4>
                  <p className="text-sm text-muted-foreground">Products with 4+ reviews convert 50% better. Focus on getting reviews for new products.</p>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Conversion Rate by Traffic Source</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={[
                      { id: 1, source: "Email Marketing", rate: 12.5 },
                      { id: 2, source: "Organic Search", rate: 8.2 },
                      { id: 3, source: "Social Media", rate: 6.3 },
                      { id: 4, source: "Paid Ads", rate: 4.8 },
                      { id: 5, source: "Direct Traffic", rate: 9.1 }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="source" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="rate" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Shopify Integration Settings</CardTitle>
              <CardDescription>Configure your store integration and automation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Auto-sync products</p>
                    <p className="text-sm text-muted-foreground">Automatically sync product updates</p>
                  </div>
                  <Switch 
                    checked={autoSyncEnabled}
                    onCheckedChange={setAutoSyncEnabled}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Generate SEO descriptions</p>
                    <p className="text-sm text-muted-foreground">Auto-create SEO-optimized product descriptions</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Automated email campaigns</p>
                    <p className="text-sm text-muted-foreground">Send cart abandonment and product recommendations</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Marketing automation</label>
                <div className="grid md:grid-cols-2 gap-4">
                  <Select defaultValue="enabled">
                    <SelectTrigger>
                      <SelectValue placeholder="Cart abandonment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enabled">Enabled</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                      <SelectItem value="custom">Custom Rules</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select defaultValue="weekly">
                    <SelectTrigger>
                      <SelectValue placeholder="Product recommendations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}