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
  AreaChart,
  Area
} from "recharts"
import { 
  Youtube,
  CheckCircle,
  AlertCircle,
  Calendar,
  TrendingUp,
  Users,
  Eye,
  ThumbsUp,
  MessageCircle,
  Share2,
  Video,
  Clock,
  Sparkles,
  BarChart3,
  Play,
  DollarSign,
  Zap,
  Upload,
  Image
} from "lucide-react"

const youtubePerformanceData = [
  { date: "Jan 1", views: 12500, subscribers: 45, revenue: 125, watchTime: 850 },
  { date: "Jan 2", views: 15200, subscribers: 67, revenue: 156, watchTime: 1020 },
  { date: "Jan 3", views: 11800, subscribers: 32, revenue: 98, watchTime: 720 },
  { date: "Jan 4", views: 18500, subscribers: 89, revenue: 201, watchTime: 1340 },
  { date: "Jan 5", views: 16900, subscribers: 78, revenue: 178, watchTime: 1180 },
  { date: "Jan 6", views: 14200, subscribers: 56, revenue: 143, watchTime: 890 },
  { date: "Jan 7", views: 19800, subscribers: 94, revenue: 234, watchTime: 1450 }
]

export function YouTubeContent() {
  const [loading, setLoading] = useState(true)
  useEffect(() => { const t = setTimeout(() => setLoading(false), 800); return () => clearTimeout(t) }, [])

  const [videoTitle, setVideoTitle] = useState("")
  const [videoDescription, setVideoDescription] = useState("")
  const [isGeneratingContent, setIsGeneratingContent] = useState(false)
  const [oAuthConnected, setOAuthConnected] = useState(true)
  const [autoPostEnabled, setAutoPostEnabled] = useState(true)

  const handleGenerateContent = () => {
    setIsGeneratingContent(true)
    setTimeout(() => {
      setVideoTitle("5 AI Tools That Will Change Your Productivity Forever")
      setVideoDescription("🤖 Discover the top 5 AI tools that are revolutionizing productivity in 2025! In this comprehensive guide, I'll show you exactly how to use each tool to save hours every week.\n\n⏰ TIMESTAMPS:\n0:00 - Introduction\n1:30 - Tool #1: AI Writing Assistant\n3:45 - Tool #2: Smart Scheduling\n6:20 - Tool #3: Automated Research\n8:10 - Tool #4: Voice-to-Text Magic\n10:30 - Tool #5: Smart Email Management\n12:45 - Conclusion & Next Steps\n\n🔗 RESOURCES MENTIONED:\n• Free productivity checklist: [link]\n• AI tools comparison sheet: [link]\n• Join our productivity community: [link]\n\n#productivity #AI #tools #efficiency #worksmarter")
      setIsGeneratingContent(false)
    }, 3000)
  }

  if (loading) return <PageSkeleton cards={3} rows={3} />

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-50 text-red-600">
            <Youtube className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">YouTube Marketing</h1>
            <p className="text-muted-foreground">Grow your channel with AI-powered content creation</p>
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
          <TabsTrigger value="scheduler">Video Scheduler</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Video Scheduler Tab */}
        <TabsContent value="scheduler" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* AI Video Content Generator */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="w-5 h-5" />
                  AI Video Content Generator
                </CardTitle>
                <CardDescription>Generate compelling titles, descriptions, and thumbnails</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Video Title</label>
                  <Input
                    placeholder="Enter your video topic..."
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    placeholder="Video description with timestamps and links..."
                    value={videoDescription}
                    onChange={(e) => setVideoDescription(e.target.value)}
                    className="min-h-[120px]"
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={handleGenerateContent}
                    disabled={isGeneratingContent}
                    className="flex-1"
                  >
                    {isGeneratingContent ? (
                      <>
                        <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Generate Content
                      </>
                    )}
                  </Button>
                  
                  <Select>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="education">Education</SelectItem>
                      <SelectItem value="entertainment">Entertainment</SelectItem>
                      <SelectItem value="howto">How-To</SelectItem>
                      <SelectItem value="review">Review</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Generate thumbnail</label>
                    <Switch defaultChecked />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">SEO optimization</label>
                    <Switch defaultChecked />
                  </div>
                </div>

                <Button className="w-full">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload & Schedule
                </Button>
              </CardContent>
            </Card>

            {/* Channel Analytics */}
            <Card>
              <CardHeader>
                <CardTitle>Channel Performance</CardTitle>
                <CardDescription>Real-time metrics from your YouTube channel</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <Eye className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">19.8K</div>
                    <div className="text-xs text-muted-foreground">Views</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <Users className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">+94</div>
                    <div className="text-xs text-muted-foreground">Subscribers</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <Clock className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">24.2h</div>
                    <div className="text-xs text-muted-foreground">Watch Time</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <DollarSign className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">$234</div>
                    <div className="text-xs text-muted-foreground">Revenue</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Average View Duration</span>
                    <span>4:32</span>
                  </div>
                  <Progress value={68} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Click-through Rate</span>
                    <span>8.4%</span>
                  </div>
                  <Progress value={84} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Thumbnail Generator */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="w-5 h-5" />
                AI Thumbnail Generator
              </CardTitle>
              <CardDescription>Create eye-catching thumbnails that increase click-through rates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                      <ImageWithFallback 
                        src={`https://images.unsplash.com/photo-${1550000000000 + i * 100}?w=300&h=200&fit=crop`}
                        alt={`Thumbnail ${i}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-2 right-2">
                        <Badge variant="secondary" className="text-xs">8:45</Badge>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="w-full">
                      Use This
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Channel Analytics</CardTitle>
              <CardDescription>Last 7 days of channel performance</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={youtubePerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="views" stroke="#ff0000" strokeWidth={2} />
                  <Line type="monotone" dataKey="subscribers" stroke="#00ff00" strokeWidth={2} />
                  <Line type="monotone" dataKey="revenue" stroke="#0000ff" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Videos</CardTitle>
                <CardDescription>Your best content this week</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="relative">
                      <ImageWithFallback 
                        src={`https://images.unsplash.com/photo-${1580000000000 + i}?w=60&h=40&fit=crop`}
                        alt="Video thumbnail"
                        className="w-16 h-10 object-cover rounded"
                      />
                      <Play className="absolute inset-0 m-auto w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">AI Productivity Video #{i}</p>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span>{(25000 - i * 3000).toLocaleString()} views</span>
                        <span>{(1500 - i * 200)} likes</span>
                      </div>
                    </div>
                    <Badge variant="secondary">{(8.5 - i * 0.5).toFixed(1)}%</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Breakdown</CardTitle>
                <CardDescription>Monetization performance</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={[
                    { id: 1, source: "Ad Revenue", amount: 180 },
                    { id: 2, source: "Channel Members", amount: 45 },
                    { id: 3, source: "Super Chat", amount: 9 },
                    { id: 4, source: "Merchandise", amount: 23 }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="source" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="amount" fill="#ff0000" radius={[4, 4, 0, 0]} />
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
                Weekly YouTube Insights
              </CardTitle>
              <CardDescription>AI-powered recommendations for channel growth</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-green-600 mb-2">📈 Growth Acceleration</h4>
                  <p className="text-sm text-muted-foreground">Your subscriber growth is up 45% this week. Consistency in posting is driving the momentum.</p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-blue-600 mb-2">🎯 Optimal Upload Time</h4>
                  <p className="text-sm text-muted-foreground">Your audience is most active on Tuesdays at 2 PM. Consider scheduling your best content then.</p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-purple-600 mb-2">🏆 High-Performing Format</h4>
                  <p className="text-sm text-muted-foreground">Tutorial videos get 3x more watch time. Focus on educational content for better retention.</p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-orange-600 mb-2">💡 Thumbnail Optimization</h4>
                  <p className="text-sm text-muted-foreground">Thumbnails with faces get 2x more clicks. Consider adding your face to increase CTR.</p>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Content Performance by Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={[
                      { id: 1, type: "Tutorials", performance: 92 },
                      { id: 2, type: "Reviews", performance: 78 },
                      { id: 3, type: "Vlogs", performance: 65 },
                      { id: 4, type: "Live Streams", performance: 71 },
                      { id: 5, type: "Shorts", performance: 88 }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="type" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="performance" fill="#ff0000" radius={[4, 4, 0, 0]} />
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
              <CardTitle>YouTube Integration Settings</CardTitle>
              <CardDescription>Configure your YouTube channel settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Auto-upload videos</p>
                    <p className="text-sm text-muted-foreground">Automatically upload scheduled videos</p>
                  </div>
                  <Switch 
                    checked={autoPostEnabled}
                    onCheckedChange={setAutoPostEnabled}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Generate thumbnails</p>
                    <p className="text-sm text-muted-foreground">Create AI thumbnails for uploads</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">SEO optimization</p>
                    <p className="text-sm text-muted-foreground">Optimize titles and descriptions for search</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Default video settings</label>
                <div className="grid md:grid-cols-2 gap-4">
                  <Select defaultValue="public">
                    <SelectTrigger>
                      <SelectValue placeholder="Privacy" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="unlisted">Unlisted</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select defaultValue="education">
                    <SelectTrigger>
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="education">Education</SelectItem>
                      <SelectItem value="entertainment">Entertainment</SelectItem>
                      <SelectItem value="howto">How-To & Style</SelectItem>
                      <SelectItem value="science">Science & Technology</SelectItem>
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