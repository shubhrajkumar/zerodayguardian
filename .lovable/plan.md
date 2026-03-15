# ZeroDay_Guardian — Full Platform Build Plan

## 1. Design System Foundation

### Theme & Colors

- Deep black base (`#0d0d0d`), neon green (`#00ff88`) for CTAs only, electric blue (`#0a84ff`) for primary accents
- CSS variables for all tokens (colors, spacing, radii, shadows) for easy future theming
- 8px spacing scale throughout

### Typography

- **Headings**: JetBrains Mono (Google Fonts, preloaded) — terminal-inspired
- **Body**: Inter (Google Fonts, preloaded) — clean readability
- Strict H1→H6 hierarchy per page for SEO

### Components

- **Glassmorphism cards**: `backdrop-blur-sm`, subtle border glow (`border-[#0a84ff]/20`), soft lift on hover via CSS `transform: translateY(-2px)`
- **Cyber-grid background**: Pure CSS animated grid overlay at 4–8% opacity, GPU-accelerated with `will-change: transform`
- **Custom scrollbar**: Thin, dark track with blue/green thumb
- **Buttons**: Neon green for primary CTAs, electric blue for secondary, ghost/outline variants

## 2. Layout & Navigation

### Sticky Navbar

- ZeroDay_Guardian branding (text logo, terminal style)
- Links: Home, Tools, Learn, Lab, Blog, Resources
- Scroll progress indicator bar (thin neon green line at top)
- Mobile: hamburger menu → slide-in sheet with smooth transition
- Active/hover: soft glow, no flicker

### Page Layout Shell

- Shared layout component wrapping all pages: Navbar + Footer + cyber-grid background
- 12-column CSS grid with responsive breakpoints (mobile-first)
- Max-width container (1400px) centered

### Footer

- Column layout: Brand info, Quick Links, Resources, Community
- Newsletter mini-signup
- Social links placeholders
- Copyright

## 3. Pages (8 total)

### Home (`/`)

- **Hero**: Full-viewport, headline + subheading + 3 CTA buttons, animated cyber-grid
- **Vulnerability of the Week**: Featured glassmorphism card (placeholder content)
- **Newsletter CTA**: "Join ZeroDay Inner Circle" email capture
- **Quick previews**: Cards linking to Tools, Learn, Lab sections

### AI Tools Review Hub (`/tools`)

- Category filter bar (AI SIEM, Endpoint Security, SOC Automation, Threat Detection)
- Tool cards grid with: name, category badge, pros/cons summary, pricing tag
- Comparison table layout ready
- All placeholder data, structured for future Supabase integration

### Learning Hub (`/learn`)

- Roadmap timeline component (beginner → advanced path)
- Topic cards: Kali Linux, Nmap, Web Exploitation, Labs
- Structured learning path UI with progress indicators (visual only)
- Resource recommendation cards

### AI + Cyber Lab (`/lab`)

- Section cards: AI Log Analysis, Malware Detection, Phishing Detection, Prompt Engineering, Automation
- Each with icon, title, description placeholder
- "Coming Soon" interactive demo placeholders

### Blog (`/blog`)

- Category filter tabs
- Search input
- Blog post cards grid (thumbnail, title, date, category badge, excerpt)
- Clean URL structure (`/blog/:slug` route ready)
- Individual blog post page template (`/blog/:slug`)

### Resources (`/resources`)

- Categorized sections: PDFs, Checklists, Toolkits, Starter Guides
- Download cards with file type icon, title, description
- Gated download placeholder (for future auth integration)

### Newsletter / Community (`/community`)

- Hero section for community value proposition
- Email signup form (connected to Supabase `newsletter_subscribers` table)
- Community benefits cards
- Discord/social join placeholders

### About / Mission (`/about`)

- Mission statement section
- Vision & values cards
- Team placeholder section
- Contact / connect section

## 4. Supabase Backend (Lovable Cloud)

### Tables

- `newsletter_subscribers`: id, email, created_at, source
- `vulnerabilities`: id, title, description, impact, prevention, severity, published_at, is_featured
- `blog_posts`: id, title, slug, excerpt, content, category, published_at, author, featured_image_url
- `tools`: id, name, category, description, pros, cons, pricing, use_cases, affiliate_url
- `resources`: id, title, description, category, file_url, file_type

### Row Level Security

- Public read access for blog posts, tools, vulnerabilities, resources
- Newsletter insert-only for anonymous users
- Admin management via future role system

## 5. Performance & Accessibility

- Lazy-loaded images with placeholder skeletons
- All animations CSS-only (`@keyframes`, `transition`), no JS animation libraries
- Font preloading via `<link rel="preload">`
- Semantic HTML throughout
- ARIA labels on interactive elements
- SEO meta tags per page (title, description, OG tags)
- Clean URL architecture for all routes

## 6. Future-Proofing

- Modular component architecture (each section is its own component)
- Reserved space for AI chatbot widget (floating action button placeholder)
- Dashboard layout shell placeholder at `/dashboard`
- Auth-ready route structure (protected route wrapper component)
- All content components accept dynamic data props for easy Supabase swap
  ## **Additional Features to Make It Powerful**
  To make your website **freelance & audience-friendly**:
  1. **Interactive AI Tools Preview:** Let users try AI tools online or see demo screenshots.
  2. **Gamified Learning Hub:** Quizzes, achievements for cyber learners → keeps engagement high.
  3. **SEO & Blog Strategy:**
    - Keyword-rich titles
    - Internal linking across hubs
    - FAQ section for AI & Cybersecurity queries
  4. **Newsletter & Lead Capture:** Incentivize newsletter signup → free AI or cybersecurity guide.
  5. **Social Proof:** Testimonials, featured projects, success stories.
  6. **Freelance Traffic:**
    - Include **“Hire Me / Projects”** page
    - Showcase your skills in AI & Cybersecurity projects
  7. **Analytics & Tracking:** Google Analytics + Hotjar → see what visitors click, optimize conversion.
    ### Make every page **mobile-first** → most traffic is mobile
  8. Keep your **UI clean and modern** → minimalistic + interactive
  9. Integrate **social media sharing** buttons → viral traffic

## **AI Tool Review Hub**

**Goal:** Provide interactive AI tool reviews

**Sections:**

1. **Header / Filter Nav**
  - Categories: AI Writing, Design, Productivity, Security Tools
2. **Tool Cards**
  - Image, Name, Short Description, Rating, Demo/Video, CTA (Try / Read Review)
3. **Search / Filter Bar**
  - By category, rating, newest
4. **Popular / Trending Tools**
  - Highlight 3-4 tools
5. **CTA:** Submit Your Tool → crowdsourced reviews

&nbsp;

## **Learning Hub**

**Goal:** Courses, Tutorials, Quizzes for Cybersecurity & AI

**Sections:**

1. **Header / Submenu:** Courses | Tutorials | Quizzes
2. **Featured Courses**
  - Card layout with progress bar, difficulty level
3. **Interactive Quizzes / Gamification**
  - Achievements, badges, leaderboard
4. **Search by Topics**
5. **CTA:** Enroll / Start Learning

&nbsp;

## **AI + Cyber Cloud**

**Goal:** Hub for cloud-based AI & cybersecurity tools

**Sections:**

1. **Searchable Database**
  - Tools, AI models, Demos
2. **Filter / Sort by Category**
  - AI, Cybersecurity, Hybrid Tools
3. **Interactive Tool Preview**
  - Run AI tool / see output live
4. **CTA:** Try Tool / Bookmark Tool

&nbsp;

**Goal:** Provide downloadable assets

**Sections:**

1. **Quick Links to PDFs, Cheat Sheets, Tools**
2. **Filter by Category: AI / Cybersecurity**
3. **CTA:** Download / Add to Favorites

&nbsp;

## **Community (AI + Cybersecurity)**

**Goal:** Engagement & Retention

**Sections:**

1. **Forum / Discussion Board**
  - Categories: AI, Cybersecurity, Hybrid Tools
2. **Trending Topics / Hot Questions**
3. **Leaderboard / Top Contributors**
4. **CTA:** Ask Question / Join Discussion

&nbsp;

1. **Mobile-first / Responsive Design**
2. **Lazy loading images/videos**
3. **Schema markup / SEO meta tags**
4. **Component Library** (reusable React components)
5. **Social sharing & Open Graph Tags**
6. **Analytics:** Google Analytics, Hotjar
7. **Lead Capture:** Newsletter + Free AI/Cyber Guides