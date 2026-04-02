import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Progress } from "./ui/progress"
import { Calendar } from "./ui/calendar"
import {
  BarChart3, Users, Zap, DollarSign, Globe, Plus,
  CheckCircle, XCircle, Clock,
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { PageSkeleton } from "./PageSkeleton"
import {
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"

const platformStatuses = [
  { name: "Omnisend", status: "connected", icon: CheckCircle, color: "text-green-500" },
  { name: "Meta",     status: "connected", icon: CheckCircle, color: "text-green-500" },
  { name: "TikTok",   status: "pending",   icon: Clock,       color: "text-yellow-500" },
  { name: "Shopify",  status: "error",     icon: XCircle,     color: "text-red-500" },
]

const activityFeed = [
  { action: "Content generated for Instagram post",     platform: "Meta",     time: "2 min ago",  status: "success" },
  { action: "Email campaign sent to 1,200 subscribers", platform: "Omnisend", time: "1 hr ago",   status: "success" },
  { action: "TikTok video script created",              platform: "TikTok",   time: "3 hrs ago",  status: "pending" },
  { action: "Product sync failed",                      platform: "Shopify",  time: "4 hrs ago",  status: "error"   },
  { action: "YouTube thumbnail generated",              platform: "YouTube",  time: "6 hrs ago",  status: "success" },
]

const videoPerformanceData = [
  { date: "Jan 1", views: 48000 },
  { date: "Jan 2", views: 52000 },
  { date: "Jan 3", views: 38000 },
  { date: "Jan 4", views: 71000 },
  { date: "Jan 5", views: 74000 },
  { date: "Jan 6", views: 51000 },
  { date: "Jan 7", views: 91000 },
]

const contentTypeData = [
  { type: "Dance/Trend",   score: 95 },
  { type: "Educational",   score: 78 },
  { type: "Behind Scenes", score: 82 },
  { type: "Product Demo",  score: 68 },
  { type: "Q&A",           score: 71 },
]

const calendarData = new Date()

export function DashboardContent(_: { role?: string }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 900)
    return () => clearTimeout(t)
  }, [])

  const firstName = user?.displayName?.split(" ")[0] ?? "there"

  if (loading) return <PageSkeleton cards={4} rows={3} />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Welcome back, {firstName}!</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Here's what's happening with your AI campaigns today.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            <span className="hidden xs:inline">Generate Post</span>
            <span className="xs:hidden">Post</span>
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Deploy Website</span>
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Credits Left",      value: "2,500",   sub: "657 used this month",    icon: Zap        },
          { title: "Active Campaigns",  value: "24",      sub: "+4 from last week",       icon: BarChart3  },
          { title: "Ad Spend",          value: "$12,483", sub: "+8.2% from last month",   icon: DollarSign },
          { title: "Total Reach",       value: "145.2K",  sub: "+12.5% from last month",  icon: Users      },
        ].map(({ title, value, sub, icon: Icon }) => (
          <Card key={title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
              <CardTitle className="text-xs sm:text-sm font-medium">{title}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl sm:text-2xl font-bold">{value}</div>
              <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main 3-col grid */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {/* Calendar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity Calendar</CardTitle>
            <CardDescription className="text-xs">Scheduled posts and campaigns</CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-3">
            <Calendar
              mode="single"
              selected={calendarData}
              className="rounded-md border-0 w-full"
              classNames={{
                months:    "flex w-full flex-col flex-1",
                month:     "space-y-4 w-full flex-1",
                table:     "w-full border-collapse",
                head_row:  "",
                head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
                row:       "flex w-full mt-2",
                cell:      "relative h-8 w-8 text-center text-sm p-0 [&:has([aria-selected])]:bg-accent rounded-md",
                day:       "h-8 w-8 p-0 font-normal hover:bg-accent rounded-md text-xs",
              }}
              components={{
                DayContent: ({ date }) => {
                  const hasActivity = date.getDate() % 3 === 0
                  const isHigh      = date.getDate() % 5 === 0
                  return (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <span>{date.getDate()}</span>
                      {hasActivity && (
                        <div className={`absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full ${isHigh ? "bg-green-500" : "bg-blue-500"}`} />
                      )}
                    </div>
                  )
                },
              }}
            />
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <CardDescription className="text-xs">Latest actions and updates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {activityFeed.map((activity, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className={`shrink-0 w-2 h-2 rounded-full mt-1.5 ${
                  activity.status === "success" ? "bg-green-500" :
                  activity.status === "pending" ? "bg-yellow-500" : "bg-red-500"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm leading-snug">{activity.action}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{activity.platform}</Badge>
                    <span className="text-[10px] text-muted-foreground">{activity.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Platform Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Platform Status</CardTitle>
            <CardDescription className="text-xs">Integration health overview</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {platformStatuses.map((p, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <p.icon className={`h-4 w-4 shrink-0 ${p.color}`} />
                  <span className="text-sm font-medium">{p.name}</span>
                </div>
                <Badge
                  variant={p.status === "connected" ? "default" : p.status === "pending" ? "secondary" : "destructive"}
                  className="text-[10px]"
                >
                  {p.status}
                </Badge>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full mt-2 gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" />
              Add Integration
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* AI Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Usage Overview</CardTitle>
          <CardDescription className="text-xs">Content generation this month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            {[
              { label: "Content Generated", value: 73 },
              { label: "Image Creation",    value: 45 },
              { label: "Video Scripts",     value: 28 },
            ].map(({ label, value }) => (
              <div key={label} className="space-y-2">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span>{label}</span>
                  <span className="font-medium">{value}%</span>
                </div>
                <Progress value={value} className="h-1.5" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Charts row */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">

        {/* Video Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Video Performance</CardTitle>
            <CardDescription className="text-xs">Last 7 days of video metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={videoPerformanceData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#a78bfa" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `${v / 1000}k`} />
                <Tooltip formatter={(v: number) => [`${v.toLocaleString()} views`, ""]} labelStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="views" stroke="#7c3aed" strokeWidth={2} fill="url(#gradViews)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Content Type Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Content Type Performance</CardTitle>
            <CardDescription className="text-xs">Engagement score by content category</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={contentTypeData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={true} vertical={false} />
                <XAxis dataKey="type" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => [`${v}`, "Score"]} labelStyle={{ fontSize: 11 }} />
                <Bar dataKey="score" fill="#818cf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
