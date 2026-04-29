import { useEditor, EditorContent, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Image from "@tiptap/extension-image"
import Underline from "@tiptap/extension-underline"
import Placeholder from "@tiptap/extension-placeholder"
import TextAlign from "@tiptap/extension-text-align"
import { useEffect } from "react"
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, List, ListOrdered, Quote,
  Code, Link as LinkIcon, Image as ImageIcon,
  AlignLeft, AlignCenter, AlignRight,
  Undo2, Redo2,
} from "lucide-react"

interface Props {
  value:        string
  onChange:     (html: string) => void
  placeholder?: string
}

export function TiptapEditor({ value, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading:    { levels: [1, 2, 3] },
        codeBlock:  { HTMLAttributes: { class: "rounded-md bg-slate-900 text-slate-100 p-3 text-xs font-mono overflow-x-auto" } },
        blockquote: { HTMLAttributes: { class: "border-l-4 border-amber-300 pl-4 italic text-slate-700" } },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-amber-600 underline underline-offset-2 hover:text-amber-700" },
      }),
      Image.configure({
        HTMLAttributes: { class: "rounded-lg my-3 max-w-full h-auto" },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: placeholder ?? "Start writing your post..." }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[420px] px-4 py-3",
      },
    },
  })

  // Sync external value changes (e.g. when loading a post for edit)
  useEffect(() => {
    if (!editor) return
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor])

  if (!editor) {
    return (
      <div className="rounded-md border bg-background min-h-[480px] flex items-center justify-center text-xs text-muted-foreground">
        Loading editor...
      </div>
    )
  }

  return (
    <div className="rounded-md border bg-background overflow-hidden">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="border-b bg-muted/30 px-2 py-1.5 flex items-center gap-0.5 flex-wrap">
      {/* Headings */}
      <ToolbarButton
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        title="Heading 1"
      ><Heading1 className="h-3.5 w-3.5" /></ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="Heading 2"
      ><Heading2 className="h-3.5 w-3.5" /></ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        title="Heading 3"
      ><Heading3 className="h-3.5 w-3.5" /></ToolbarButton>

      <Divider />

      {/* Inline formatting */}
      <ToolbarButton
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (Ctrl+B)"
      ><Bold className="h-3.5 w-3.5" /></ToolbarButton>
      <ToolbarButton
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (Ctrl+I)"
      ><Italic className="h-3.5 w-3.5" /></ToolbarButton>
      <ToolbarButton
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline (Ctrl+U)"
      ><UnderlineIcon className="h-3.5 w-3.5" /></ToolbarButton>
      <ToolbarButton
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
      ><Strikethrough className="h-3.5 w-3.5" /></ToolbarButton>
      <ToolbarButton
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
        title="Inline code"
      ><Code className="h-3.5 w-3.5" /></ToolbarButton>

      <Divider />

      {/* Lists + quote */}
      <ToolbarButton
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet list"
      ><List className="h-3.5 w-3.5" /></ToolbarButton>
      <ToolbarButton
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numbered list"
      ><ListOrdered className="h-3.5 w-3.5" /></ToolbarButton>
      <ToolbarButton
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Blockquote"
      ><Quote className="h-3.5 w-3.5" /></ToolbarButton>

      <Divider />

      {/* Alignment */}
      <ToolbarButton
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        title="Align left"
      ><AlignLeft className="h-3.5 w-3.5" /></ToolbarButton>
      <ToolbarButton
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        title="Align center"
      ><AlignCenter className="h-3.5 w-3.5" /></ToolbarButton>
      <ToolbarButton
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        title="Align right"
      ><AlignRight className="h-3.5 w-3.5" /></ToolbarButton>

      <Divider />

      {/* Link + image */}
      <ToolbarButton
        active={editor.isActive("link")}
        onClick={() => {
          const prev = editor.getAttributes("link").href as string | undefined
          const url = window.prompt("Link URL", prev ?? "https://")
          if (url === null) return
          if (url === "") return editor.chain().focus().extendMarkRange("link").unsetLink().run()
          editor.chain().focus().extendMarkRange("link").setLink({ href: url, target: "_blank", rel: "noopener noreferrer" }).run()
        }}
        title="Insert / edit link"
      ><LinkIcon className="h-3.5 w-3.5" /></ToolbarButton>
      <ToolbarButton
        onClick={() => {
          const url = window.prompt("Image URL")
          if (!url) return
          editor.chain().focus().setImage({ src: url }).run()
        }}
        title="Insert image"
      ><ImageIcon className="h-3.5 w-3.5" /></ToolbarButton>

      <Divider />

      {/* History */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo (Ctrl+Z)"
      ><Undo2 className="h-3.5 w-3.5" /></ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo (Ctrl+Shift+Z)"
      ><Redo2 className="h-3.5 w-3.5" /></ToolbarButton>
    </div>
  )
}

function ToolbarButton({
  active, disabled, onClick, title, children,
}: {
  active?:    boolean
  disabled?:  boolean
  onClick:    () => void
  title:      string
  children:   React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? "bg-amber-100 text-amber-700"
          : "hover:bg-muted text-muted-foreground hover:text-foreground"
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="w-px h-5 bg-border mx-0.5" />
}
