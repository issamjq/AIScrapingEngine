import { useState, useEffect } from "react"
import { PageSkeleton, TableSkeleton } from "./PageSkeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Calendar } from "./ui/calendar"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { ImageWithFallback } from "./figma/ImageWithFallback"
import { 
  Calendar as CalendarIcon,
  Clock,
  Filter,
  Plus,
  Edit,
  Eye,
  MoreHorizontal,
  TrendingUp,
  Users,
  Target,
  Facebook,
  Instagram,
  Youtube,
  Twitter,
  Music,
  Send,
  Lightbulb
} from "lucide-react"

interface ScheduledPost {
  id: string
  content: string
  platform: string
  scheduledTime: Date
  status: "scheduled" | "published" | "draft" | "failed"
  image?: string
  engagement?: {
    likes: number
    comments: number
    shares: number
  }
}

const platforms = [
  { id: "all", name: "All Platforms", icon: Target, color: "text-gray-600" },
  { id: "meta", name: "Meta", icon: Facebook, color: "text-blue-600" },
  { id: "instagram", name: "Instagram", icon: Instagram, color: "text-pink-600" },
  { id: "tiktok", name: "TikTok", icon: Music, color: "text-black" },
  { id: "youtube", name: "YouTube", icon: Youtube, color: "text-red-600" },
  { id: "twitter", name: "Twitter/X", icon: Twitter, color: "text-blue-400" },
  { id: "omnisend", name: "Omnisend", icon: Send, color: "text-purple-600" },
]

const bestTimes = {
  meta: { day: "Tuesday", time: "2:00 PM", engagement: "23% higher" },
  instagram: { day: "Wednesday", time: "11:00 AM", engagement: "31% higher" },
  tiktok: { day: "Thursday", time: "6:00 PM", engagement: "45% higher" },
  youtube: { day: "Saturday", time: "3:00 PM", engagement: "28% higher" },
  twitter: { day: "Wednesday", time: "9:00 AM", engagement: "19% higher" },
  omnisend: { day: "Tuesday", time: "10:00 AM", engagement: "41% higher" },
}

const mockPosts: ScheduledPost[] = [
  {
    id: "1",
    content: "🚀 Exciting product launch coming this Friday! Stay tuned for something amazing. #ProductLaunch #Innovation",
    platform: "instagram",
    scheduledTime: new Date(2025, 0, 3, 14, 0),
    status: "scheduled",
    image: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=300&h=200&fit=crop"
  },
  {
    id: "2",
    content: "Check out our latest blog post about AI marketing trends for 2025. Link in bio! 📈",
    platform: "meta",
    scheduledTime: new Date(2025, 0, 4, 10, 30),
    status: "scheduled",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=300&h=200&fit=crop"
  },
  {
    id: "3",
    content: "Behind the scenes: How our team creates amazing content every day 🎬 #BTS #ContentCreation",
    platform: "tiktok",
    scheduledTime: new Date(2025, 0, 5, 18, 0),
    status: "scheduled"
  },
  {
    id: "4",
    content: "Weekly newsletter is out! Featuring top marketing insights and exclusive tips 📧",
    platform: "omnisend",
    scheduledTime: new Date(2025, 0, 6, 9, 0),
    status: "published",
    engagement: { likes: 156, comments: 23, shares: 45 }
  }
]

export function PostSchedulerContent(_: { role?: string }) {
  const [loading, setLoading] = useState(true)
  useEffect(() => { const t = setTimeout(() => setLoading(false), 850); return () => clearTimeout(t) }, [])

  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedPlatform, setSelectedPlatform] = useState("all")
  const [posts, setPosts] = useState<ScheduledPost[]>(mockPosts)
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  const filteredPosts = posts.filter(post => 
    selectedPlatform === "all" || post.platform === selectedPlatform
  )

  const getPostsForDate = (date: Date) => {
    return filteredPosts.filter(post => 
      post.scheduledTime.toDateString() === date.toDateString()
    )
  }

  const getPlatformIcon = (platformId: string) => {
    const platform = platforms.find(p => p.id === platformId)
    return platform ? platform.icon : Target
  }

  const getPlatformColor = (platformId: string) => {
    const platform = platforms.find(p => p.id === platformId)
    return platform ? platform.color : "text-gray-600"
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled": return "bg-blue-100 text-blue-800"
      case "published": return "bg-green-100 text-green-800"
      case "draft": return "bg-gray-100 text-gray-800"
      case "failed": return "bg-red-100 text-red-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const PostPreviewModal = ({ post, isOpen, onOpenChange }: { 
    post: ScheduledPost | null, 
    isOpen: boolean, 
    onOpenChange: (open: boolean) => void 
  }) => {
    if (!post) return null
    
    const PlatformIcon = getPlatformIcon(post.platform)
    
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlatformIcon className={`w-5 h-5 ${getPlatformColor(post.platform)}`} />
              Post Preview
            </DialogTitle>
            <DialogDescription>
              Scheduled for {post.scheduledTime.toLocaleDateString()} at {post.scheduledTime.toLocaleTimeString()}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {post.image && (
              <ImageWithFallback 
                src={post.image}
                alt="Post image"
                className="w-full h-48 object-cover rounded-lg"
              />
            )}
            
            <div className="bg-muted rounded-lg p-4">
              <p>{post.content}</p>
            </div>
            
            <div className="flex items-center justify-between">
              <Badge className={getStatusColor(post.status)}>
                {post.status}
              </Badge>
              
              {post.engagement && (
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>{post.engagement.likes} likes</span>
                  <span>{post.engagement.comments} comments</span>
                  <span>{post.engagement.shares} shares</span>
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button>
                <Edit className="w-4 h-4 mr-2" />
                Edit Post
              </Button>
              <Button variant="outline">
                Reschedule
              </Button>
              <Button variant="outline">
                Duplicate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (loading) return <TableSkeleton rows={6} />

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Post Scheduler</h1>
          <p className="text-muted-foreground">Schedule and manage your social media content</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Schedule Post
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sidebar */}
        <div className="space-y-6">
          {/* Platform Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Platforms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {platforms.map((platform) => {
                const PlatformIcon = platform.icon
                const isActive = selectedPlatform === platform.id
                
                return (
                  <Button
                    key={platform.id}
                    variant={isActive ? "default" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setSelectedPlatform(platform.id)}
                  >
                    <PlatformIcon className={`w-4 h-4 mr-2 ${platform.color}`} />
                    {platform.name}
                  </Button>
                )
              })}
            </CardContent>
          </Card>

          {/* Best Time Suggestions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="w-5 h-5" />
                Best Times
              </CardTitle>
              <CardDescription>Optimal posting times for your audience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(bestTimes).map(([platformId, timing]) => {
                const platform = platforms.find(p => p.id === platformId)
                if (!platform) return null
                
                const PlatformIcon = platform.icon
                
                return (
                  <div key={platformId} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <PlatformIcon className={`w-4 h-4 ${platform.color}`} />
                      <span className="font-medium">{platform.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{timing.day}</div>
                      <div className="text-xs text-muted-foreground">{timing.time}</div>
                    </div>
                  </div>
                )
              })}
              
              <Button variant="outline" size="sm" className="w-full mt-3">
                <TrendingUp className="w-4 h-4 mr-2" />
                View Analytics
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Calendar and Posts */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Calendar */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Calendar</CardTitle>
                <CardDescription>Click on a date to view scheduled posts</CardDescription>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  className="rounded-md border-0"
                  components={{
                    DayContent: ({ date }) => {
                      const postsForDate = getPostsForDate(date)
                      const hasScheduled = postsForDate.some(p => p.status === 'scheduled')
                      const hasPublished = postsForDate.some(p => p.status === 'published')
                      
                      return (
                        <div className="relative w-full h-full flex items-center justify-center">
                          <span>{date.getDate()}</span>
                          {postsForDate.length > 0 && (
                            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                              {hasScheduled && (
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                              )}
                              {hasPublished && (
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                              )}
                            </div>
                          )}
                        </div>
                      )
                    }
                  }}
                />
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="font-semibold text-lg">24</div>
                    <div className="text-xs text-muted-foreground">Scheduled</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="font-semibold text-lg">156</div>
                    <div className="text-xs text-muted-foreground">Published</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="font-semibold text-lg">8.2%</div>
                    <div className="text-xs text-muted-foreground">Avg Engagement</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="font-semibold text-lg">45.2K</div>
                    <div className="text-xs text-muted-foreground">Total Reach</div>
                  </div>
                </div>
                
                <Button variant="outline" className="w-full">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  View Detailed Analytics
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Scheduled Posts for Selected Date */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Posts for {selectedDate.toLocaleDateString()}
              </CardTitle>
              <CardDescription>
                {getPostsForDate(selectedDate).length} posts scheduled
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {getPostsForDate(selectedDate).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CalendarIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No posts scheduled for this date</p>
                    <Button variant="outline" className="mt-2">
                      <Plus className="w-4 h-4 mr-2" />
                      Schedule Post
                    </Button>
                  </div>
                ) : (
                  getPostsForDate(selectedDate).map((post) => {
                    const PlatformIcon = getPlatformIcon(post.platform)
                    
                    return (
                      <div 
                        key={post.id}
                        className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                        onClick={() => {
                          setSelectedPost(post)
                          setIsPreviewOpen(true)
                        }}
                      >
                        {post.image && (
                          <ImageWithFallback 
                            src={post.image}
                            alt="Post preview"
                            className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                          />
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <PlatformIcon className={`w-4 h-4 ${getPlatformColor(post.platform)}`} />
                            <Badge className={getStatusColor(post.status)}>
                              {post.status}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {post.scheduledTime.toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-sm line-clamp-2">{post.content}</p>
                          
                          {post.engagement && (
                            <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                              <span>{post.engagement.likes} likes</span>
                              <span>{post.engagement.comments} comments</span>
                              <span>{post.engagement.shares} shares</span>
                            </div>
                          )}
                        </div>
                        
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <PostPreviewModal 
        post={selectedPost}
        isOpen={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
      />
    </div>
  )
}