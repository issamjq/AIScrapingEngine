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
  ResponsiveContainer
} from "recharts"
import { 
  Twitter,
  CheckCircle,
  AlertCircle,
  Calendar,
  TrendingUp,
  Users,
  Eye,
  Heart,
  MessageCircle,
  Repeat2,
  Hash,
  Clock,
  Sparkles,
  BarChart3,
  Zap,
  AtSign
} from "lucide-react"

const twitterPerformanceData = [
  { date: "Jan 1", impressions: 8500, engagements: 420, retweets: 45, likes: 280 },
  { date: "Jan 2", impressions: 12200, engagements: 680, retweets: 67, likes: 450 },
  { date: "Jan 3", impressions: 7800, engagements: 320, retweets: 32, likes: 210 },
  { date: "Jan 4", impressions: 15500, engagements: 890, retweets: 89, likes: 620 },
  { date: "Jan 5", impressions: 11900, engagements: 640, retweets: 58, likes: 420 },
  { date: "Jan 6", impressions: 9200, engagements: 480, retweets: 43, likes: 310 },
  { date: "Jan 7", impressions: 16800, engagements: 980, retweets: 102, likes: 680 }
]

const trendingTopics = [
  { topic: "#AI", posts: "45.2K", growth: "+23%" },
  { topic: "#Tech", posts: "32.1K", growth: "+15%" },
  { topic: "#Marketing", posts: "28.7K", growth: "+18%" },
  { topic: "#Productivity", posts: "21.4K", growth: "+12%" },
  { topic: "#Innovation", posts: "19.8K", growth: "+9%" }
]

export function TwitterContent(_: { role?: string }) {
  const [loading, setLoading] = useState(true)
  useEffect(() => { const t = setTimeout(() => setLoading(false), 750); return () => clearTimeout(t) }, [])

  const [tweetContent, setTweetContent] = useState("")
  const [isGeneratingTweet, setIsGeneratingTweet] = useState(false)
  const [oAuthConnected, setOAuthConnected] = useState(true)
  const [autoPostEnabled, setAutoPostEnabled] = useState(true)
  const [threadMode, setThreadMode] = useState(false)

  const handleGenerateTweet = () => {
    setIsGeneratingTweet(true)
    setTimeout(() => {
      const tweets = [
        "🚀 Just discovered an AI tool that's completely changing how I approach content creation. Here's what makes it special:",
        "💡 5 productivity hacks that actually work:\n\n1. Time-blocking with 90-min focus sessions\n2. AI for first drafts, human for final edits\n3. Batch similar tasks together\n4. Use the 2-minute rule religiously\n5. Say no to meetings without agendas\n\nWhich one will you try first?",
        "The future of marketing isn't about selling products.\n\nIt's about solving problems before people know they have them.\n\nAI is making this level of predictive service possible for everyone. 🧠✨"
      ]
      setTweetContent(tweets[Math.floor(Math.random() * tweets.length)])
      setIsGeneratingTweet(false)
    }, 2000)
  }

  const getCharacterCount = () => {
    return tweetContent.length
  }

  const getCharacterColor = () => {
    const count = getCharacterCount()
    if (count > 280) return "text-red-500"
    if (count > 250) return "text-orange-500"
    return "text-muted-foreground"
  }

  if (loading) return <PageSkeleton cards={3} rows={3} />

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-400">
            <Twitter className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Twitter/X Marketing</h1>
            <p className="text-muted-foreground">Engage your audience with compelling tweets and threads</p>
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
          <TabsTrigger value="scheduler">Tweet Scheduler</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Tweet Scheduler Tab */}
        <TabsContent value="scheduler" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* AI Tweet Generator */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  AI Tweet Generator
                </CardTitle>
                <CardDescription>Generate engaging tweets that drive conversation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Tweet Content</label>
                    <span className={`text-xs ${getCharacterColor()}`}>
                      {getCharacterCount()}/280
                    </span>
                  </div>
                  <Textarea
                    placeholder="What's happening? Let AI help you craft the perfect tweet..."
                    value={tweetContent}
                    onChange={(e) => setTweetContent(e.target.value)}
                    className="min-h-[100px]"
                    maxLength={280}
                  />
                  <Progress 
                    value={(getCharacterCount() / 280) * 100} 
                    className="h-1" 
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={handleGenerateTweet}
                    disabled={isGeneratingTweet}
                    className="flex-1"
                  >
                    {isGeneratingTweet ? (
                      <>
                        <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Generate Tweet
                      </>
                    )}
                  </Button>
                  
                  <Select>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Tone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="humorous">Humorous</SelectItem>
                      <SelectItem value="inspiring">Inspiring</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Thread mode</label>
                    <Switch 
                      checked={threadMode}
                      onCheckedChange={setThreadMode}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Add hashtags</label>
                    <Switch defaultChecked />
                  </div>
                </div>

                <Button className="w-full">
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule Tweet
                </Button>
              </CardContent>
            </Card>

            {/* Today's Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Today's Performance</CardTitle>
                <CardDescription>Real-time metrics from your Twitter account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <Eye className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">16.8K</div>
                    <div className="text-xs text-muted-foreground">Impressions</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <Heart className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">680</div>
                    <div className="text-xs text-muted-foreground">Likes</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <Repeat2 className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">102</div>
                    <div className="text-xs text-muted-foreground">Retweets</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <MessageCircle className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">45</div>
                    <div className="text-xs text-muted-foreground">Replies</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Engagement Rate</span>
                    <span>5.8%</span>
                  </div>
                  <Progress value={58} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Profile Visits</span>
                    <span>234</span>
                  </div>
                  <Progress value={45} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Link Clicks</span>
                    <span>89</span>
                  </div>
                  <Progress value={30} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Trending Topics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="w-5 h-5" />
                Trending Topics
              </CardTitle>
              <CardDescription>What's trending in your industry right now</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-5 gap-4">
                {trendingTopics.map((topic, index) => (
                  <div key={index} className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <div className="font-medium text-blue-600">{topic.topic}</div>
                    <div className="text-xs text-muted-foreground">{topic.posts} tweets</div>
                    <div className="text-xs text-green-600">{topic.growth}</div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm">💡 <strong>AI Tip:</strong> Your tweets with #AI and #Productivity get 40% more engagement. Consider using these hashtags in your next post.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tweet Performance</CardTitle>
              <CardDescription>Last 7 days of engagement metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={twitterPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="impressions" stroke="#1da1f2" strokeWidth={2} />
                  <Line type="monotone" dataKey="engagements" stroke="#17bf63" strokeWidth={2} />
                  <Line type="monotone" dataKey="likes" stroke="#e1306c" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Tweets</CardTitle>
                <CardDescription>Your best content this week</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-3 border rounded-lg">
                    <p className="text-sm mb-2">🚀 Just shipped a major update to our AI platform. The new features are going to change how you think about productivity...</p>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <div className="flex gap-3">
                        <span>{(5400 - i * 600)} impressions</span>
                        <span>{(420 - i * 50)} likes</span>
                        <span>{(67 - i * 10)} retweets</span>
                      </div>
                      <Badge variant="secondary">{(6.8 - i * 0.5).toFixed(1)}%</Badge>
                    </div>
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
                    { id: 1, hour: "6AM", activity: 15 },
                    { id: 2, hour: "9AM", activity: 65 },
                    { id: 3, hour: "12PM", activity: 85 },
                    { id: 4, hour: "3PM", activity: 90 },
                    { id: 5, hour: "6PM", activity: 75 },
                    { id: 6, hour: "9PM", activity: 45 },
                    { id: 7, hour: "12AM", activity: 20 }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="activity" fill="#1da1f2" radius={[4, 4, 0, 0]} />
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
                Weekly Twitter Insights
              </CardTitle>
              <CardDescription>AI-powered recommendations for better engagement</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-green-600 mb-2">🎯 Engagement Boost</h4>
                  <p className="text-sm text-muted-foreground">Your engagement rate is up 35% this week. Tweets with questions get 2x more replies.</p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-blue-600 mb-2">⏰ Optimal Timing</h4>
                  <p className="text-sm text-muted-foreground">Your audience is most active at 3 PM on weekdays. Schedule important tweets then for maximum reach.</p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-purple-600 mb-2">💬 Thread Success</h4>
                  <p className="text-sm text-muted-foreground">Your threads perform 3x better than single tweets. Consider breaking long-form content into threads.</p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-orange-600 mb-2">🏷️ Hashtag Power</h4>
                  <p className="text-sm text-muted-foreground">Tweets with 2-3 hashtags get optimal reach. More than 3 hashtags reduce engagement by 17%.</p>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Content Performance by Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={[
                      { id: 1, type: "Questions", engagement: 85 },
                      { id: 2, type: "Tips/Lists", engagement: 78 },
                      { id: 3, type: "Industry News", engagement: 62 },
                      { id: 4, type: "Personal Stories", engagement: 73 },
                      { id: 5, type: "Threads", engagement: 92 }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="type" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="engagement" fill="#1da1f2" radius={[4, 4, 0, 0]} />
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
              <CardTitle>Twitter/X Integration Settings</CardTitle>
              <CardDescription>Configure your Twitter account integration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Auto-post tweets</p>
                    <p className="text-sm text-muted-foreground">Automatically post scheduled tweets</p>
                  </div>
                  <Switch 
                    checked={autoPostEnabled}
                    onCheckedChange={setAutoPostEnabled}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Thread detection</p>
                    <p className="text-sm text-muted-foreground">Automatically create threads for long content</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Auto-engage mentions</p>
                    <p className="text-sm text-muted-foreground">Like and reply to mentions automatically</p>
                  </div>
                  <Switch />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Default posting schedule</label>
                <div className="grid md:grid-cols-2 gap-4">
                  <Select defaultValue="3pm">
                    <SelectTrigger>
                      <SelectValue placeholder="Optimal time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="9am">9:00 AM</SelectItem>
                      <SelectItem value="12pm">12:00 PM</SelectItem>
                      <SelectItem value="3pm">3:00 PM</SelectItem>
                      <SelectItem value="6pm">6:00 PM</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select defaultValue="3">
                    <SelectTrigger>
                      <SelectValue placeholder="Tweets per day" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 tweet per day</SelectItem>
                      <SelectItem value="3">3 tweets per day</SelectItem>
                      <SelectItem value="5">5 tweets per day</SelectItem>
                      <SelectItem value="8">8 tweets per day</SelectItem>
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