import { Link } from "react-router-dom";
import React, { useState } from "react";
import { sanitize } from "@/utils/sanitize";

type BlogPost = {
  title: string;
  slug: string;
  category: string;
  date: string;
  excerpt: string;
  readTime?: string;
  externalUrl?: string;
};

interface BlogCardProps {
  post: BlogPost;
}

const BlogCard: React.FC<BlogCardProps> = ({ post }) => {
  const [expanded, setExpanded] = useState(false);
  const previewStyle = expanded
    ? undefined
    : ({
      display: "-webkit-box",
      WebkitLineClamp: 5,
      WebkitBoxOrient: "vertical",
      overflow: "hidden",
    } as React.CSSProperties);
  const card = (
    <article className="glass-card rounded-lg p-6 group">
      <div className="flex items-center justify-between mb-3">
        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-primary/20 text-primary">{sanitize(post.category)}</span>
        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
          {post.readTime ? <span className="rounded-full border border-cyan-300/30 px-2 py-0.5 text-cyan-100/90">{sanitize(post.readTime)}</span> : null}
          <span>{sanitize(post.date)}</span>
        </div>
      </div>
      <h3 className="font-mono text-base font-semibold mb-2 group-hover:text-accent transition-colors leading-snug tracking-tight">
        {post.externalUrl ? (
          <a href={post.externalUrl} target="_blank" rel="noreferrer noopener" className="hover:text-accent">
            {sanitize(post.title)}
          </a>
        ) : (
          <Link to={`/blog/${post.slug}`} className="hover:text-accent">
            {sanitize(post.title)}
          </Link>
        )}
      </h3>
      <p className="text-sm text-muted-foreground whitespace-pre-line leading-6" style={previewStyle}>{sanitize(post.excerpt)}</p>
      <button
        type="button"
        className="mt-3 text-xs text-cyan-200 hover:text-cyan-100"
        onClick={(event) => {
          event.preventDefault();
          setExpanded((prev) => !prev);
        }}
      >
        {expanded ? "Read Less" : "Read More"}
      </button>
      {post.externalUrl ? (
        <a href={post.externalUrl} target="_blank" rel="noreferrer noopener" className="mt-2 inline-block text-xs text-cyan-200 hover:text-cyan-100">
          Open Source
        </a>
      ) : (
        <Link to={`/blog/${post.slug}`} className="mt-2 inline-block text-xs text-cyan-200 hover:text-cyan-100">
          Open Article
        </Link>
      )}
    </article>
  );
  return card;
};

export default BlogCard;
