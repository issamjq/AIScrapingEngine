import { useState, useEffect } from "react"
import { PageSkeleton } from "./PageSkeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Textarea } from "./ui/textarea"
import { Switch } from "./ui/switch"
import { Progress } from "./ui/progress"
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
  AreaChart,
  Area,
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
  Facebook,
  Instagram,
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
  Target,
  Zap,
  Clock,
  Sparkles,
  BarChart3
} from "lucide-react"

const performanceData = [
  { date: "Jan 1", reach: 12500, engagement: 890, clicks: 156 },
  { date: "Jan 2", reach: 15200, engagement: 1240, clicks: 203 },
  { date: "Jan 3", reach: 11800, engagement: 780, clicks: 145 },
  { date: "Jan 4", reach: 18500, engagement: 1650, clicks: 298 },
  { date: "Jan 5", reach: 16900, engagement: 1420, clicks: 267 },
  { date: "Jan 6", reach: 14200, engagement: 1180, clicks: 189 },
  { date: "Jan 7", reach: 19800, engagement: 1890, clicks: 342 }
]

const audienceData = [
  { name: "18-24", value: 28, color: "#3b82f6" },
  { name: "25-34", value: 42, color: "#10b981" },
  { name: "35-44", value: 20, color: "#f59e0b" },
  { name: "45-54", value: 10, color: "#ef4444" }
]

export function MetaContent() {
  const [loading, setLoading] = useState(true)
  useEffect(() => { const t = setTimeout(() => setLoading(false), 800); return () => clearTimeout(t) }, [])

  const [postContent, setPostContent] = useState("")
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false)
  const [oAuthConnected, setOAuthConnected] = useState(true)
  const [autoPostEnabled, setAutoPostEnabled] = useState(true)

  const handleGenerateCaption = () => {
    setIsGeneratingCaption(true)
    setTimeout(() => {
      setPostContent("🚀 Exciting news! Our latest product launch is here and it's going to revolutionize your workflow. Experience the future of productivity with cutting-edge AI technology. \n\n✨ Key features:\n• AI-powered automation\n• Seamless integrations\n• Real-time analytics\n\n#ProductLaunch #Innovation #AI #TechStartup #Productivity")
      setIsGeneratingCaption(false)
    }, 2000)
  }

  if (loading) return <PageSkeleton cards={3} rows={3} />

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
            <Facebook className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Meta Marketing</h1>
            <p className="text-muted-foreground">Manage your Facebook and Instagram campaigns</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {oAuthConnected ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium">Connected</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium">Disconnected</span>
              </>
            )}
          </div>
          <Button variant="outline">Reconnect</Button>
        </div>
      </div>

      <Tabs defaultValue="scheduler" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="scheduler">Post Scheduler</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Post Scheduler Tab */}
        <TabsContent value="scheduler" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* AI Caption Generator */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  AI Caption Generator
                </CardTitle>
                <CardDescription>Generate engaging captions for your Meta posts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Describe your post content or let AI generate a caption..."
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  className="min-h-[120px]"
                />
                
                <div className="flex gap-2">
                  <Button 
                    onClick={handleGenerateCaption}
                    disabled={isGeneratingCaption}
                    className="flex-1"
                  >
                    {isGeneratingCaption ? (
                      <>
                        <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Generate Caption
                      </>
                    )}
                  </Button>
                  
                  <Select>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Tone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="humorous">Humorous</SelectItem>
                      <SelectItem value="inspirational">Inspirational</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Include hashtags</label>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Post to Instagram too</label>
                  <Switch defaultChecked />
                </div>

                <Button className="w-full">
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule Post
                </Button>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Today's Performance</CardTitle>
                <CardDescription>Real-time metrics from your Meta campaigns</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <Eye className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">24.5K</div>
                    <div className="text-xs text-muted-foreground">Reach</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <Heart className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">1,847</div>
                    <div className="text-xs text-muted-foreground">Engagement</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <MessageCircle className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">203</div>
                    <div className="text-xs text-muted-foreground">Comments</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <Share2 className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">156</div>
                    <div className="text-xs text-muted-foreground">Shares</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Engagement Rate</span>
                    <span>7.5%</span>
                  </div>
                  <Progress value={75} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Ad Spend Today</span>
                    <span>$284</span>
                  </div>
                  <Progress value={60} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Auto-Post Integration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Auto-Post Integration
              </CardTitle>
              <CardDescription>Automated posting settings and status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-posting enabled</p>
                  <p className="text-sm text-muted-foreground">Posts will be automatically published at optimal times</p>
                </div>
                <Switch 
                  checked={autoPostEnabled}
                  onCheckedChange={setAutoPostEnabled}
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Best posting time</label>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">2:00 PM</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Frequency</label>
                  <Select defaultValue="daily">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="every-other">Every Other Day</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Content type</label>
                  <Select defaultValue="mixed">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mixed">Mixed Content</SelectItem>
                      <SelectItem value="image">Images Only</SelectItem>
                      <SelectItem value="video">Videos Only</SelectItem>
                      <SelectItem value="text">Text Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Performance</CardTitle>
                <CardDescription>Last 7 days of campaign metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="reach" stroke="#3b82f6" strokeWidth={2} />
                    <Line type="monotone" dataKey="engagement" stroke="#10b981" strokeWidth={2} />
                    <Line type="monotone" dataKey="clicks" stroke="#f59e0b" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Audience Demographics</CardTitle>
                  <CardDescription>Age distribution of your audience</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={audienceData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}%`}
                      >
                        {audienceData.map((entry, index) => (
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
                  <CardTitle>Top Performing Posts</CardTitle>
                  <CardDescription>Your best content this week</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <ImageWithFallback 
                        src={`https://images.unsplash.com/photo-${1500000000000 + i}?w=60&h=60&fit=crop`}
                        alt="Post preview"
                        className="w-12 h-12 object-cover rounded-lg"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Product Launch Post #{i}</p>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span>{(2500 - i * 200).toLocaleString()} reach</span>
                          <span>{(180 - i * 20)} engagements</span>
                        </div>
                      </div>
                      <Badge variant="secondary">{8.5 - i * 0.5}%</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* AI Insights Tab */}
        <TabsContent value="insights" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Weekly AI Insights
              </CardTitle>
              <CardDescription>AI-powered recommendations based on your performance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-green-600 mb-2">📈 Performance Up 23%</h4>
                  <p className="text-sm text-muted-foreground">Your engagement rate increased significantly this week. Posts with images perform 40% better than text-only posts.</p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-blue-600 mb-2">🎯 Optimal Posting Time</h4>
                  <p className="text-sm text-muted-foreground">Your audience is most active between 1-3 PM. Consider scheduling more posts during this window.</p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-purple-600 mb-2">💬 Engagement Opportunity</h4>
                  <p className="text-sm text-muted-foreground">Posts with questions get 60% more comments. Try asking your audience about their preferences.</p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-orange-600 mb-2">🔥 Trending Content</h4>
                  <p className="text-sm text-muted-foreground">Behind-the-scenes content is trending in your industry. Consider showing your team's work process.</p>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Content Performance Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={[
                      { id: 1, type: "Images", performance: 85 },
                      { id: 2, type: "Videos", performance: 92 },
                      { id: 3, type: "Carousels", performance: 78 },
                      { id: 4, type: "Text Posts", performance: 45 },
                      { id: 5, type: "Stories", performance: 67 }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="type" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="performance" fill="#3b82f6" radius={[4, 4, 0, 0]} />
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
              <CardTitle>Meta Integration Settings</CardTitle>
              <CardDescription>Configure your Facebook and Instagram integration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Facebook Pages Access</p>
                    <p className="text-sm text-muted-foreground">Allow posting to your Facebook pages</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Instagram Business Account</p>
                    <p className="text-sm text-muted-foreground">Connect your Instagram business profile</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Auto-approve AI content</p>
                    <p className="text-sm text-muted-foreground">Automatically approve AI-generated posts</p>
                  </div>
                  <Switch />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Default posting schedule</label>
                <div className="grid md:grid-cols-2 gap-4">
                  <Select defaultValue="weekdays">
                    <SelectTrigger>
                      <SelectValue placeholder="Days" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekdays">Weekdays Only</SelectItem>
                      <SelectItem value="weekends">Weekends Only</SelectItem>
                      <SelectItem value="custom">Custom Schedule</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select defaultValue="afternoon">
                    <SelectTrigger>
                      <SelectValue placeholder="Time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">Morning (9-12 PM)</SelectItem>
                      <SelectItem value="afternoon">Afternoon (12-5 PM)</SelectItem>
                      <SelectItem value="evening">Evening (5-9 PM)</SelectItem>
                      <SelectItem value="night">Night (9 PM-12 AM)</SelectItem>
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