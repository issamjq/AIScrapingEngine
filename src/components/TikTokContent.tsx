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
  Music,
  CheckCircle,
  AlertCircle,
  Calendar,
  TrendingUp,
  Users,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Video,
  Clock,
  Sparkles,
  BarChart3,
  Play,
  Hash,
  Zap
} from "lucide-react"

const tiktokPerformanceData = [
  { date: "Jan 1", views: 45000, likes: 3200, shares: 180, comments: 240 },
  { date: "Jan 2", views: 52000, likes: 4100, shares: 220, comments: 310 },
  { date: "Jan 3", views: 38000, likes: 2800, shares: 150, comments: 190 },
  { date: "Jan 4", views: 67000, likes: 5400, shares: 340, comments: 420 },
  { date: "Jan 5", views: 71000, likes: 6200, shares: 390, comments: 480 },
  { date: "Jan 6", views: 49000, likes: 3800, shares: 210, comments: 290 },
  { date: "Jan 7", views: 84000, likes: 7100, shares: 450, comments: 560 }
]

const trendingHashtags = [
  { tag: "#fyp", posts: "2.4M", growth: "+15%" },
  { tag: "#viral", posts: "1.8M", growth: "+23%" },
  { tag: "#trending", posts: "1.2M", growth: "+8%" },
  { tag: "#foryou", posts: "980K", growth: "+12%" },
  { tag: "#trend", posts: "750K", growth: "+19%" }
]

export function TikTokContent(_: { role?: string }) {
  const [loading, setLoading] = useState(true)
  useEffect(() => { const t = setTimeout(() => setLoading(false), 750); return () => clearTimeout(t) }, [])

  const [videoScript, setVideoScript] = useState("")
  const [isGeneratingScript, setIsGeneratingScript] = useState(false)
  const [oAuthConnected, setOAuthConnected] = useState(true)
  const [autoPostEnabled, setAutoPostEnabled] = useState(false)

  const handleGenerateScript = () => {
    setIsGeneratingScript(true)
    setTimeout(() => {
      setVideoScript("🎬 HOOK: \"This productivity hack changed my life!\"\n\n📱 SCENE 1: Show cluttered workspace\n\"Before: My desk was a mess, I couldn't focus...\"\n\n✨ SCENE 2: Reveal the solution\n\"Then I discovered this simple 5-minute morning routine\"\n\n🚀 SCENE 3: Show transformation\n\"Now look at my organized workspace and productivity!\"\n\n💡 CTA: \"Try this hack and tag me in your results!\"\n\nSUGGESTED MUSIC: Upbeat motivational track\nDURATION: 30-45 seconds\n\n#productivity #lifehack #workspace #organization #fyp")
      setIsGeneratingScript(false)
    }, 2500)
  }

  if (loading) return <PageSkeleton cards={3} rows={3} />

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-black text-white">
            <Music className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">TikTok Marketing</h1>
            <p className="text-muted-foreground">Create viral content and engage with your audience</p>
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
            {/* AI Video Script Generator */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="w-5 h-5" />
                  AI Video Script Generator
                </CardTitle>
                <CardDescription>Generate engaging TikTok video scripts and hooks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Describe your video idea or let AI create a viral script..."
                  value={videoScript}
                  onChange={(e) => setVideoScript(e.target.value)}
                  className="min-h-[150px]"
                />
                
                <div className="flex gap-2">
                  <Button 
                    onClick={handleGenerateScript}
                    disabled={isGeneratingScript}
                    className="flex-1"
                  >
                    {isGeneratingScript ? (
                      <>
                        <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Generate Script
                      </>
                    )}
                  </Button>
                  
                  <Select>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Style" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="educational">Educational</SelectItem>
                      <SelectItem value="entertainment">Entertainment</SelectItem>
                      <SelectItem value="behind-scenes">Behind Scenes</SelectItem>
                      <SelectItem value="trending">Trending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Trending sounds</label>
                    <Switch defaultChecked />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Viral hashtags</label>
                    <Switch defaultChecked />
                  </div>
                </div>

                <Button className="w-full">
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule Video
                </Button>
              </CardContent>
            </Card>

            {/* TikTok Analytics */}
            <Card>
              <CardHeader>
                <CardTitle>Today's Performance</CardTitle>
                <CardDescription>Real-time metrics from your TikTok videos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <Eye className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">84.2K</div>
                    <div className="text-xs text-muted-foreground">Views</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <Heart className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">7,103</div>
                    <div className="text-xs text-muted-foreground">Likes</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <MessageCircle className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">560</div>
                    <div className="text-xs text-muted-foreground">Comments</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <Share2 className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">450</div>
                    <div className="text-xs text-muted-foreground">Shares</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Engagement Rate</span>
                    <span>9.8%</span>
                  </div>
                  <Progress value={98} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Completion Rate</span>
                    <span>73%</span>
                  </div>
                  <Progress value={73} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Trending Hashtags */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="w-5 h-5" />
                Trending Hashtags
              </CardTitle>
              <CardDescription>Popular hashtags in your niche right now</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-5 gap-4">
                {trendingHashtags.map((hashtag, index) => (
                  <div key={index} className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <div className="font-medium text-blue-600">{hashtag.tag}</div>
                    <div className="text-xs text-muted-foreground">{hashtag.posts} posts</div>
                    <div className="text-xs text-green-600">{hashtag.growth}</div>
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
              <CardTitle>Video Performance</CardTitle>
              <CardDescription>Last 7 days of video metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={tiktokPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="views" stackId="1" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="likes" stackId="1" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Videos</CardTitle>
                <CardDescription>Your most successful content this week</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="relative">
                      <ImageWithFallback 
                        src={`https://images.unsplash.com/photo-${1600000000000 + i}?w=60&h=60&fit=crop`}
                        alt="Video thumbnail"
                        className="w-12 h-12 object-cover rounded-lg"
                      />
                      <Play className="absolute inset-0 m-auto w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Viral Video #{i}</p>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span>{(150000 - i * 20000).toLocaleString()} views</span>
                        <span>{(8500 - i * 500)} likes</span>
                      </div>
                    </div>
                    <Badge variant="secondary">{(12.5 - i * 0.8).toFixed(1)}%</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Audience Activity</CardTitle>
                <CardDescription>When your followers are most active</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={[
                    { id: 1, hour: "6AM", activity: 20 },
                    { id: 2, hour: "9AM", activity: 45 },
                    { id: 3, hour: "12PM", activity: 70 },
                    { id: 4, hour: "3PM", activity: 85 },
                    { id: 5, hour: "6PM", activity: 95 },
                    { id: 6, hour: "9PM", activity: 80 },
                    { id: 7, hour: "12AM", activity: 40 }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="activity" fill="#8884d8" radius={[4, 4, 0, 0]} />
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
                Weekly TikTok Insights
              </CardTitle>
              <CardDescription>AI-powered recommendations for viral content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-green-600 mb-2">🚀 Viral Potential High</h4>
                  <p className="text-sm text-muted-foreground">Your latest video format has 85% chance of going viral. Post more similar content between 6-8 PM.</p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-purple-600 mb-2">🎵 Trending Sounds</h4>
                  <p className="text-sm text-muted-foreground">Videos using trending audio get 3x more views. We've identified 5 perfect sounds for your niche.</p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-blue-600 mb-2">⏱️ Perfect Duration</h4>
                  <p className="text-sm text-muted-foreground">Your 15-30 second videos perform best. Completion rates drop 40% after 45 seconds.</p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-orange-600 mb-2">💬 Engagement Boost</h4>
                  <p className="text-sm text-muted-foreground">Videos with text overlays get 60% more engagement. Add captions to increase accessibility.</p>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Content Type Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={[
                      { type: "Dance/Trend", engagement: 95 },
                      { type: "Educational", engagement: 78 },
                      { type: "Behind Scenes", engagement: 82 },
                      { type: "Product Demo", engagement: 68 },
                      { type: "Q&A", engagement: 71 }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="type" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="engagement" fill="#8884d8" radius={[4, 4, 0, 0]} />
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
              <CardTitle>TikTok Integration Settings</CardTitle>
              <CardDescription>Configure your TikTok business account settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Auto-post videos</p>
                    <p className="text-sm text-muted-foreground">Automatically post scheduled videos</p>
                  </div>
                  <Switch 
                    checked={autoPostEnabled}
                    onCheckedChange={setAutoPostEnabled}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Use trending sounds</p>
                    <p className="text-sm text-muted-foreground">Automatically suggest trending audio</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Auto-generate hashtags</p>
                    <p className="text-sm text-muted-foreground">Add trending hashtags to posts</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Optimal posting times</label>
                <div className="grid md:grid-cols-2 gap-4">
                  <Select defaultValue="evening">
                    <SelectTrigger>
                      <SelectValue placeholder="Primary time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">Morning (6-9 AM)</SelectItem>
                      <SelectItem value="afternoon">Afternoon (12-3 PM)</SelectItem>
                      <SelectItem value="evening">Evening (6-9 PM)</SelectItem>
                      <SelectItem value="night">Night (9 PM-12 AM)</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select defaultValue="3">
                    <SelectTrigger>
                      <SelectValue placeholder="Posts per day" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 post per day</SelectItem>
                      <SelectItem value="2">2 posts per day</SelectItem>
                      <SelectItem value="3">3 posts per day</SelectItem>
                      <SelectItem value="5">5 posts per day</SelectItem>
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