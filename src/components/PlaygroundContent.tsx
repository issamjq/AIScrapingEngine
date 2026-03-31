import { useState, useEffect } from "react"
import { PageSkeleton } from "./PageSkeleton"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Textarea } from "./ui/textarea"
import { Switch } from "./ui/switch"
import { Badge } from "./ui/badge"
import { Separator } from "./ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { 
  Mic, 
  Send, 
  RefreshCw, 
  RotateCcw, 
  Save, 
  Calendar,
  Mail,
  Globe,
  Library,
  Download,
  Bot,
  User,
  Copy,
  ThumbsUp,
  ThumbsDown
} from "lucide-react"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

export function PlaygroundContent() {
  const [loading, setLoading] = useState(true)
  useEffect(() => { const t = setTimeout(() => setLoading(false), 700); return () => clearTimeout(t) }, [])

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hello! I'm your AI marketing assistant. I can help you create engaging content for social media, write compelling emails, generate product descriptions, and much more. What would you like to work on today?",
      timestamp: new Date()
    }
  ])
  
  const [inputValue, setInputValue] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [toggles, setToggles] = useState({
    postScheduler: false,
    omnisendEmail: false,
    websiteBuilder: false,
    addToLibrary: true,
    download: false
  })

  const handleSendMessage = () => {
    if (!inputValue.trim()) return

    const newMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, newMessage])
    setInputValue("")

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Here's a compelling marketing copy based on your request:\n\n🚀 **Transform Your Marketing Game Today!**\n\nDiscover the power of AI-driven content creation that converts. Our platform helps you:\n• Generate engaging social media posts\n• Create compelling email campaigns\n• Build conversion-optimized landing pages\n\nReady to 10x your marketing results? Let's get started!\n\n*Would you like me to refine this further or create variations for different platforms?*`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, aiResponse])
    }, 1500)
  }

  const handleToggleChange = (key: keyof typeof toggles) => {
    setToggles(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleRephrase = () => {
    // Simulate rephrasing the last AI message
    const lastAiMessage = messages.findLast(msg => msg.role === "assistant")
    if (lastAiMessage) {
      const rephrasedMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        content: `Here's a fresh take on that content:\n\n✨ **Revolutionize Your Marketing Strategy!**\n\nUnlock the potential of intelligent content creation. Our AI-powered platform empowers you to:\n• Craft viral social media content\n• Design high-converting email sequences\n• Develop persuasive landing pages\n\nReady to elevate your brand's presence? Let's make it happen!\n\n*Feel free to ask for more variations or specific platform adaptations.*`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, rephrasedMessage])
    }
  }

  const handleRetry = () => {
    // Remove last AI message and regenerate
    setMessages(prev => {
      const newMessages = [...prev]
      if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === "assistant") {
        newMessages.pop()
      }
      return newMessages
    })

    setTimeout(() => {
      const retryMessage: Message = {
        id: (Date.now() + 3).toString(),
        role: "assistant",
        content: `Let me try a different approach:\n\n💡 **Supercharge Your Content Strategy**\n\nExperience next-level marketing with AI that understands your brand. Get:\n• Personalized content recommendations\n• Multi-platform campaign optimization\n• Real-time performance insights\n\nYour audience is waiting. Let's create something amazing together!\n\n*What specific type of content would you like to focus on?*`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, retryMessage])
    }, 1000)
  }

  if (loading) return <PageSkeleton cards={2} rows={4} />

  return (
    <div className="flex h-full">
      {/* Chat Interface */}
      <div className="flex-1 flex flex-col">
        <div className="p-6 border-b">
          <h1 className="text-2xl font-semibold">AI Playground</h1>
          <p className="text-muted-foreground">Generate content, get suggestions, and refine your marketing materials</p>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((message) => (
            <div key={message.id} className="flex gap-4">
              <Avatar className="w-8 h-8 flex-shrink-0">
                {message.role === "user" ? (
                  <>
                    <AvatarImage src="/avatars/user.png" />
                    <AvatarFallback>
                      <User className="w-4 h-4" />
                    </AvatarFallback>
                  </>
                ) : (
                  <>
                    <AvatarImage src="/avatars/ai.png" />
                    <AvatarFallback>
                      <Bot className="w-4 h-4" />
                    </AvatarFallback>
                  </>
                )}
              </Avatar>
              
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {message.role === "user" ? "You" : "AI Assistant"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                
                <div className="bg-muted rounded-lg p-4">
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </div>
                
                {message.role === "assistant" && (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm">
                      <Copy className="w-4 h-4 mr-1" />
                      Copy
                    </Button>
                    <Button variant="ghost" size="sm">
                      <ThumbsUp className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <ThumbsDown className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t">
          <div className="flex gap-2 mb-4">
            <Button variant="outline" onClick={handleRephrase}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Rephrase
            </Button>
            <Button variant="outline" onClick={handleRetry}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Retry
            </Button>
            <Button variant="outline">
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>

          {/* Input Area */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Describe what you'd like me to help you create..."
                className="min-h-[60px] pr-12 resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
              />
              <Button 
                variant="ghost" 
                size="sm"
                className={`absolute right-2 top-2 ${isRecording ? 'text-red-500' : ''}`}
                onClick={() => setIsRecording(!isRecording)}
              >
                <Mic className="w-4 h-4" />
              </Button>
            </div>
            <Button onClick={handleSendMessage} disabled={!inputValue.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Action Toggles Sidebar */}
      <div className="w-80 border-l bg-muted/20">
        <div className="p-6">
          <h3 className="font-medium mb-4">Output Actions</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Send to Post Scheduler</span>
              </div>
              <Switch 
                checked={toggles.postScheduler}
                onCheckedChange={() => handleToggleChange('postScheduler')}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Omnisend Email</span>
              </div>
              <Switch 
                checked={toggles.omnisendEmail}
                onCheckedChange={() => handleToggleChange('omnisendEmail')}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Website Builder</span>
              </div>
              <Switch 
                checked={toggles.websiteBuilder}
                onCheckedChange={() => handleToggleChange('websiteBuilder')}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Library className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Add to Library</span>
              </div>
              <Switch 
                checked={toggles.addToLibrary}
                onCheckedChange={() => handleToggleChange('addToLibrary')}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Download</span>
              </div>
              <Switch 
                checked={toggles.download}
                onCheckedChange={() => handleToggleChange('download')}
              />
            </div>
          </div>

          <Separator className="my-6" />

          <div className="space-y-3">
            <h4 className="text-sm font-medium">Active Integrations</h4>
            {Object.entries(toggles).filter(([_, enabled]) => enabled).map(([key, _]) => (
              <Badge key={key} variant="secondary" className="text-xs">
                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}