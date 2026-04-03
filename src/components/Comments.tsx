import { useState, useEffect } from "react";

interface CommentsProps {
  storageKey: string;
}

const Comments: React.FC<CommentsProps> = ({ storageKey }) => {
  const [comments, setComments] = useState<string[]>([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setComments(JSON.parse(stored));
      }
    } catch {
      // Ignore malformed local comment storage and keep the UI usable.
    }
  }, [storageKey]);

  const addComment = () => {
    const text = input.trim();
    if (!text) return;
    const updated = [...comments, text];
    setComments(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setInput("");
  };

  return (
    <div className="mt-12">
      <h3 className="font-mono text-lg font-semibold mb-4">Comments</h3>
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-4">
          No comments yet. Be the first to write something!
        </p>
      ) : (
        <ul className="space-y-2 mb-4">
          {comments.map((c, i) => (
            <li key={i} className="bg-secondary/50 p-3 rounded">
              <p className="text-sm text-foreground whitespace-pre-wrap">{c}</p>
            </li>
          ))}
        </ul>
      )}
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="w-full p-3 rounded border border-primary/20 bg-background text-foreground focus:outline-none h-24"
        placeholder="Write a comment..."
      />
      <button
        onClick={addComment}
        className="mt-2 px-4 py-2 bg-accent text-accent-foreground rounded font-mono text-sm hover:bg-accent/90"
      >
        Add Comment
      </button>
    </div>
  );
};

export default Comments;
