"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ImageExtension from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { useState } from "react";
import { ui } from "@/lib/ui-text";
export function RichEditor({
  value,
  onChange,
  onInsertImage,
}: {
  value: string;
  onChange: (value: string) => void;
  onInsertImage?: () => Promise<{
    url: string;
    altText: string;
    width: number;
    height: number;
  } | null>;
}) {
  const [link, setLink] = useState("");
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false },
      }),
      ImageExtension.configure({ allowBase64: false }),
      TableKit,
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "rich-content editor-body",
        role: "textbox",
        "aria-label": ui.body,
      },
    },
  });
  if (!editor) return <div className="editor-body">{ui.loading}</div>;
  const tools: [string, () => void][] = [
    ["Bold", () => editor.chain().focus().toggleBold().run()],
    ["Italic", () => editor.chain().focus().toggleItalic().run()],
    ["H2", () => editor.chain().focus().toggleHeading({ level: 2 }).run()],
    ["H3", () => editor.chain().focus().toggleHeading({ level: 3 }).run()],
    ["Bullets", () => editor.chain().focus().toggleBulletList().run()],
    ["Numbered list", () => editor.chain().focus().toggleOrderedList().run()],
    [
      "Table",
      () =>
        editor
          .chain()
          .focus()
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run(),
    ],
    ["Add row", () => editor.chain().focus().addRowAfter().run()],
    ["Add column", () => editor.chain().focus().addColumnAfter().run()],
    ["Remove table", () => editor.chain().focus().deleteTable().run()],
    ["Undo", () => editor.chain().focus().undo().run()],
  ];
  return (
    <div className="editor">
      <div className="editor-toolbar">
        {tools.map(([name, run]) => (
          <button type="button" key={name} onClick={run}>
            {name}
          </button>
        ))}
        {onInsertImage && (
          <button
            type="button"
            onClick={async () => {
              const image = await onInsertImage();
              if (image)
                editor
                  .chain()
                  .focus()
                  .setImage({
                    src: image.url,
                    alt: image.altText,
                    width: image.width,
                    height: image.height,
                  })
                  .run();
            }}
          >
            {ui.inlineImage}
          </button>
        )}
      </div>
      <div className="editor-toolbar">
        <input
          aria-label="Link URL"
          type="url"
          placeholder="https://"
          value={link}
          onChange={(event) => setLink(event.target.value)}
        />
        <button
          type="button"
          onClick={() => {
            if (/^https:\/\//.test(link))
              editor.chain().focus().setLink({ href: link }).run();
          }}
        >
          Add link
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().unsetLink().run()}
        >
          Remove link
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
