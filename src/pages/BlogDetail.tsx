import { useParams, Link } from "react-router-dom";
import blogData from "../data/blogs.json";
import NotFound from "./NotFound";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import Comments from "@/components/Comments";
import { sanitize } from "@/utils/sanitize";

// derive type
type BlogPost = (typeof blogData)[number];

const BlogDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return <NotFound />;

  const post = blogData.find((p) => p.slug === slug) as BlogPost | undefined;
  if (!post) return <NotFound />;

  // related posts (same category)
  const related = blogData
    .filter((p) => p.category === post.category && p.slug !== post.slug)
    .slice(0, 3) as BlogPost[];

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-mono text-3xl md:text-4xl font-bold mb-2">{post.title}</h1>
        <div className="flex items-center gap-2 mb-4">
          <span className="px-2 py-0.5 rounded text-xs font-mono bg-primary/20 text-primary">{post.category}</span>
          <span className="text-xs text-muted-foreground">
            {format(new Date(post.date), "MMM d, yyyy")}
          </span>
        </div>
        <div className="prose prose-invert text-muted-foreground mb-8">
          {sanitize(post.content)}
        </div>

        <div className="flex flex-wrap gap-4 mb-12">
          <Button asChild>
            <Link to="#" className="font-mono">
              Share
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="#" className="font-mono">
              Bookmark
            </Link>
          </Button>
        </div>

        {related.length > 0 && (
          <section>
            <h2 className="font-mono text-xl font-semibold mb-4">Related Articles</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {related.map((r) => (
                <Link key={r.slug} to={`/blog/${r.slug}`}>
                  <div className="glass-card rounded-lg p-4 hover:shadow-lg transition-shadow">
                    <h3 className="font-mono font-semibold mb-1">{r.title}</h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {r.excerpt}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
        <Comments storageKey={`blog-${post.slug}`} />
      </div>
    </div>
  );
};

export default BlogDetail;
