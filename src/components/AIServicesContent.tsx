import { useState, useEffect } from "react"
import { PageSkeleton } from "./PageSkeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Textarea } from "./ui/textarea"
import { Badge } from "./ui/badge"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { Progress } from "./ui/progress"
import { ImageWithFallback } from "./figma/ImageWithFallback"
import { 
  Image,
  Video,
  Globe,
  FileText,
  Scissors,
  Sparkles,
  Calendar,
  Mail,
  Library,
  Download,
  Play,
  Pause,
  RotateCcw,
  Wand2
} from "lucide-react"

interface ServiceCard {
  id: string
  title: string
  description: string
  icon: any
  color: string
  models: string[]
  presets: string[]
  outputType: "image" | "video" | "text" | "website"
}

const services: ServiceCard[] = [
  {
    id: "text-to-image",
    title: "Text to Image",
    description: "Generate stunning images from text descriptions",
    icon: Image,
    color: "bg-blue-50 text-blue-600",
    models: ["DALL-E 3", "Midjourney", "Stable Diffusion", "Firefly"],
    presets: ["Product Photo", "Social Media Post", "Banner", "Portrait", "Landscape", "Abstract"],
    outputType: "image"
  },
  {
    id: "text-to-video",
    title: "Text to Video",
    description: "Create engaging videos from text prompts",
    icon: Video,
    color: "bg-purple-50 text-purple-600",
    models: ["Runway ML", "Pika Labs", "Stable Video", "Luma AI"],
    presets: ["Product Demo", "Social Reel", "Explainer", "Animation", "Slideshow"],
    outputType: "video"
  },
  {
    id: "website-builder",
    title: "Website Builder",
    description: "Build complete websites with AI assistance",
    icon: Globe,
    color: "bg-green-50 text-green-600",
    models: ["GPT-4", "Claude", "Gemini Pro"],
    presets: ["Landing Page", "Portfolio", "E-commerce", "Blog", "Business Card"],
    outputType: "website"
  },
  {
    id: "summarizer",
    title: "Summarizer",
    description: "Summarize long content into key points",
    icon: FileText,
    color: "bg-orange-50 text-orange-600",
    models: ["GPT-4", "Claude", "Gemini Pro", "Cohere"],
    presets: ["Executive Summary", "Key Points", "Tweet Thread", "Email Brief", "Social Caption"],
    outputType: "text"
  },
  {
    id: "clipper",
    title: "Clipper",
    description: "Extract highlights and clips from long content",
    icon: Scissors,
    color: "bg-pink-50 text-pink-600",
    models: ["Whisper", "AssemblyAI", "Rev.ai", "Deepgram"],
    presets: ["Best Moments", "Key Quotes", "Action Clips", "Highlights Reel", "Sound Bites"],
    outputType: "video"
  }
]

export function AIServicesContent(_: { role?: string }) {
  const [loading, setLoading] = useState(true)
  useEffect(() => { const t = setTimeout(() => setLoading(false), 750); return () => clearTimeout(t) }, [])

  const [activeService, setActiveService] = useState<string | null>(null)
  const [prompts, setPrompts] = useState<Record<string, string>>({})
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>({})
  const [selectedPresets, setSelectedPresets] = useState<Record<string, string>>({})
  const [isGenerating, setIsGenerating] = useState<Record<string, boolean>>({})
  const [results, setResults] = useState<Record<string, any>>({})

  const handleGenerate = async (serviceId: string) => {
    setIsGenerating(prev => ({ ...prev, [serviceId]: true }))
    
    // Simulate generation process
    setTimeout(() => {
      const service = services.find(s => s.id === serviceId)
      let mockResult = {}
      
      switch (service?.outputType) {
        case "image":
          mockResult = {
            url: `https://images.unsplash.com/photo-1634128221889-82ed6efebfc3?w=500&h=300&fit=crop`,
            alt: "Generated image",
            metadata: { size: "1024x768", format: "PNG" }
          }
          break
        case "video":
          mockResult = {
            url: "video_preview.mp4",
            thumbnail: `https://images.unsplash.com/photo-1536240478700-b869070f9279?w=500&h=300&fit=crop`,
            duration: "0:15",
            metadata: { resolution: "1920x1080", format: "MP4" }
          }
          break
        case "text":
          mockResult = {
            content: "This is a generated summary of your content. Key points include market analysis, competitive advantages, and growth projections for the upcoming quarter.",
            wordCount: 156,
            readingTime: "1 min"
          }
          break
        case "website":
          mockResult = {
            preview: `https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500&h=300&fit=crop`,
            pages: 3,
            url: "preview.html"
          }
          break
      }
      
      setResults(prev => ({ ...prev, [serviceId]: mockResult }))
      setIsGenerating(prev => ({ ...prev, [serviceId]: false }))
    }, 3000)
  }

  const handleExport = (serviceId: string, exportType: string) => {
    console.log(`Exporting ${serviceId} to ${exportType}`)
  }

  const renderServiceCard = (service: ServiceCard) => {
    const isActive = activeService === service.id
    const isLoading = isGenerating[service.id]
    const result = results[service.id]
    const ServiceIcon = service.icon

    return (
      <Card key={service.id} className={`transition-all ${isActive ? 'ring-2 ring-primary' : ''}`}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${service.color}`}>
              <ServiceIcon className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{service.title}</CardTitle>
              <CardDescription>{service.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Prompt Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Prompt</label>
            <Textarea
              placeholder={`Describe what you want to ${service.title.toLowerCase()}...`}
              value={prompts[service.id] || ""}
              onChange={(e) => setPrompts(prev => ({ ...prev, [service.id]: e.target.value }))}
              className="min-h-[80px]"
            />
          </div>

          {/* Model Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Model</label>
              <Select 
                value={selectedModels[service.id] || ""} 
                onValueChange={(value) => setSelectedModels(prev => ({ ...prev, [service.id]: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {service.models.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Preset</label>
              <Select 
                value={selectedPresets[service.id] || ""} 
                onValueChange={(value) => setSelectedPresets(prev => ({ ...prev, [service.id]: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select preset" />
                </SelectTrigger>
                <SelectContent>
                  {service.presets.map((preset) => (
                    <SelectItem key={preset} value={preset}>
                      {preset}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Generate Button */}
          <Button 
            onClick={() => handleGenerate(service.id)}
            disabled={!prompts[service.id] || isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                Generate
              </>
            )}
          </Button>

          {/* Loading Progress */}
          {isLoading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing...</span>
                <span>65%</span>
              </div>
              <Progress value={65} className="h-2" />
            </div>
          )}

          {/* Result Preview */}
          {result && (
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Result Preview</h4>
                <Badge variant="secondary">Ready</Badge>
              </div>
              
              {service.outputType === "image" && (
                <div className="space-y-2">
                  <ImageWithFallback 
                    src={result.url}
                    alt={result.alt}
                    className="w-full h-40 object-cover rounded-lg"
                  />
                  <p className="text-xs text-muted-foreground">{result.metadata.size} • {result.metadata.format}</p>
                </div>
              )}

              {service.outputType === "video" && (
                <div className="space-y-2">
                  <div className="relative">
                    <ImageWithFallback 
                      src={result.thumbnail}
                      alt="Video thumbnail"
                      className="w-full h-40 object-cover rounded-lg"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Button size="sm" variant="secondary" className="rounded-full">
                        <Play className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{result.duration} • {result.metadata.resolution}</p>
                </div>
              )}

              {service.outputType === "text" && (
                <div className="space-y-2">
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-sm">{result.content}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{result.wordCount} words • {result.readingTime}</p>
                </div>
              )}

              {service.outputType === "website" && (
                <div className="space-y-2">
                  <ImageWithFallback 
                    src={result.preview}
                    alt="Website preview"
                    className="w-full h-40 object-cover rounded-lg"
                  />
                  <p className="text-xs text-muted-foreground">{result.pages} pages generated</p>
                </div>
              )}

              {/* Export Options */}
              <div className="flex flex-wrap gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleExport(service.id, "post")}
                >
                  <Calendar className="w-3 h-3 mr-1" />
                  Post
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleExport(service.id, "email")}
                >
                  <Mail className="w-3 h-3 mr-1" />
                  Email
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleExport(service.id, "website")}
                >
                  <Globe className="w-3 h-3 mr-1" />
                  Website
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleExport(service.id, "library")}
                >
                  <Library className="w-3 h-3 mr-1" />
                  Library
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleExport(service.id, "download")}
                >
                  <Download className="w-3 h-3 mr-1" />
                  Download
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (loading) return <PageSkeleton cards={4} rows={2} />

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">AI Services</h1>
        <p className="text-muted-foreground">Transform your ideas into content with powerful AI tools</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {services.map(renderServiceCard)}
      </div>
    </div>
  )
}