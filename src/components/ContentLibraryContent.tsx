import { useState, useEffect } from "react"
import { PageSkeleton, CardGridSkeleton } from "./PageSkeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Badge } from "./ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { ImageWithFallback } from "./figma/ImageWithFallback"
import { 
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Calendar,
  Mail,
  Download,
  Copy,
  Trash2,
  Image,
  Type,
  Video,
  FileText,
  Clock
} from "lucide-react"

const mockAssets = {
  "ai-assets": [
    {
      id: "1",
      title: "Summer Sale Banner",
      type: "image",
      platform: "Instagram",
      created: "2 hours ago",
      versions: 3,
      status: "published"
    },
    {
      id: "2", 
      title: "Product Hero Image",
      type: "image",
      platform: "Website",
      created: "1 day ago",
      versions: 5,
      status: "draft"
    },
    {
      id: "3",
      title: "Brand Logo Variations",
      type: "image",
      platform: "Multi-platform",
      created: "3 days ago",
      versions: 8,
      status: "published"
    }
  ],
  "captions": [
    {
      id: "4",
      title: "Black Friday Campaign Copy",
      type: "text",
      platform: "Facebook",
      created: "1 hour ago",
      versions: 2,
      status: "scheduled"
    },
    {
      id: "5",
      title: "Product Launch Announcement",
      type: "text", 
      platform: "Twitter",
      created: "4 hours ago",
      versions: 4,
      status: "published"
    },
    {
      id: "6",
      title: "Customer Testimonial Post",
      type: "text",
      platform: "LinkedIn",
      created: "2 days ago",
      versions: 1,
      status: "draft"
    }
  ],
  "videos": [
    {
      id: "7",
      title: "Product Demo Video",
      type: "video",
      platform: "YouTube",
      created: "3 hours ago",
      versions: 2,
      status: "processing"
    },
    {
      id: "8",
      title: "Behind the Scenes Reel",
      type: "video",
      platform: "Instagram", 
      created: "1 day ago",
      versions: 3,
      status: "published"
    }
  ],
  "emails": [
    {
      id: "9",
      title: "Welcome Series Email 1",
      type: "email",
      platform: "Omnisend",
      created: "2 hours ago",
      versions: 3,
      status: "sent"
    },
    {
      id: "10",
      title: "Newsletter Template",
      type: "email",
      platform: "Omnisend",
      created: "5 hours ago", 
      versions: 2,
      status: "draft"
    }
  ]
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case "image": return Image
    case "text": return Type
    case "video": return Video
    case "email": return Mail
    default: return FileText
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "published": return "bg-green-100 text-green-800"
    case "draft": return "bg-gray-100 text-gray-800"
    case "scheduled": return "bg-blue-100 text-blue-800"
    case "processing": return "bg-yellow-100 text-yellow-800"
    case "sent": return "bg-purple-100 text-purple-800"
    default: return "bg-gray-100 text-gray-800"
  }
}

export function ContentLibraryContent(_: { role?: string }) {
  const [loading, setLoading] = useState(true)
  useEffect(() => { const t = setTimeout(() => setLoading(false), 800); return () => clearTimeout(t) }, [])

  const [searchTerm, setSearchTerm] = useState("")
  const [selectedPlatform, setSelectedPlatform] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")

  const handleExportToScheduler = (assetId: string) => {
    console.log("Exporting to Post Scheduler:", assetId)
  }

  const handleExportToEmail = (assetId: string) => {
    console.log("Exporting to Email:", assetId)
  }

  const renderAssetCard = (asset: any) => {
    const TypeIcon = getTypeIcon(asset.type)
    
    return (
      <Card key={asset.id} className="group hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <TypeIcon className="w-4 h-4 text-muted-foreground" />
              <Badge variant="outline" className="text-xs">
                {asset.platform}
              </Badge>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Copy className="w-4 h-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleExportToScheduler(asset.id)}>
                  <Calendar className="w-4 h-4 mr-2" />
                  Export to Post Scheduler
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportToEmail(asset.id)}>
                  <Mail className="w-4 h-4 mr-2" />
                  Export to Email
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          {asset.type === "image" && (
            <div className="aspect-video bg-muted rounded-md mb-3 flex items-center justify-center">
              <ImageWithFallback 
                src={`https://images.unsplash.com/photo-${1500000000000 + parseInt(asset.id)}?w=300&h=200&fit=crop`}
                alt={asset.title}
                className="w-full h-full object-cover rounded-md"
              />
            </div>
          )}
          
          {asset.type === "video" && (
            <div className="aspect-video bg-muted rounded-md mb-3 flex items-center justify-center">
              <Video className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
          
          {(asset.type === "text" || asset.type === "email") && (
            <div className="bg-muted rounded-md p-3 mb-3">
              <p className="text-sm text-muted-foreground line-clamp-3">
                {asset.type === "email" ? "Subject: " + asset.title : asset.title}
              </p>
            </div>
          )}
          
          <div className="space-y-2">
            <h3 className="font-medium text-sm line-clamp-1">{asset.title}</h3>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {asset.created}
              </div>
              <span>{asset.versions} versions</span>
            </div>
            <div className="flex items-center justify-between">
              <Badge className={`text-xs ${getStatusColor(asset.status)}`}>
                {asset.status}
              </Badge>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm">
                  <Eye className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) return <CardGridSkeleton count={6} />

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Content Library</h1>
          <p className="text-muted-foreground">Manage and organize your AI-generated content</p>
        </div>
        <Button>
          <FileText className="w-4 h-4 mr-2" />
          New Asset
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="facebook">Facebook</SelectItem>
            <SelectItem value="twitter">Twitter</SelectItem>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
            <SelectItem value="youtube">YouTube</SelectItem>
            <SelectItem value="omnisend">Omnisend</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
          </SelectContent>
        </Select>
        
        <Button variant="outline">
          <Filter className="w-4 h-4 mr-2" />
          More Filters
        </Button>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="ai-assets" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ai-assets">AI Assets</TabsTrigger>
          <TabsTrigger value="captions">Captions</TabsTrigger>
          <TabsTrigger value="videos">Videos</TabsTrigger>
          <TabsTrigger value="emails">Emails</TabsTrigger>
        </TabsList>

        {Object.entries(mockAssets).map(([key, assets]) => (
          <TabsContent key={key} value={key} className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {assets.length} items
              </p>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {assets.map(renderAssetCard)}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}