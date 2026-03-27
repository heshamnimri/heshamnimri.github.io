import Image from "next/image";
import Link from "next/link";
import "../blog.css";
import "./page.css";

export default function ElectionsBlogPost() {
  return (
    <article className="blog-post">
      <header className="blog-post-header">
        <time dateTime="2024-11-05">November 5, 2024</time>
        <h1 className="blog-post-title">
          Behind the Lens: Covering the 2024 Elections
        </h1>
      </header>

      <div className="blog-post-body">
        <p>
          Election day in New York City carries a weight that you feel before you
          see it. The morning started early in the Bronx, where families lined up
          outside polling stations before the doors opened. There was no fanfare,
          just people showing up.
        </p>

        <div className="blog-post-image">
          <Image
            src="/photos/elections/1.jpg"
            alt="Family going to vote in the Bronx, New York City"
            width={1200}
            height={800}
            style={{ width: "100%", height: "auto" }}
            loading="lazy"
          />
          <div className="image-caption">
            Family going to vote in the Bronx, New York City
          </div>
        </div>

        <p>
          What struck me most was the quiet determination. Parents brought their
          children. Grandparents came with walkers. This was not performance.
          This was civic life as lived experience, passed down through
          generations in neighborhoods where every vote has always been a fight.
        </p>

        <div className="blog-post-image">
          <Image
            src="/photos/elections/2.jpg"
            alt="Young voter proudly wears voting stickers"
            width={1200}
            height={800}
            style={{ width: "100%", height: "auto" }}
            loading="lazy"
          />
          <div className="image-caption">
            Young voter proudly wears voting stickers
          </div>
        </div>

        <p>
          The younger voters wore their stickers like badges. There is something
          about the first time you vote that stays with you. I wanted to capture
          that pride without staging it. The best documentary photography happens
          when you wait.
        </p>

        <div className="blog-post-image">
          <Image
            src="/photos/elections/3.jpg"
            alt="Inside a Bronx polling station"
            width={1200}
            height={800}
            style={{ width: "100%", height: "auto" }}
            loading="lazy"
          />
          <div className="image-caption">Inside a Bronx polling station</div>
        </div>

        <p>
          Inside the polling stations, the atmosphere was almost meditative.
          Volunteers guided people through the process with patience. The
          machinery of democracy is mundane up close. Folding tables, paper
          ballots, privacy screens. But that mundanity is the point. It works
          because ordinary people make it work.
        </p>

        <div className="blog-post-image">
          <Image
            src="/photos/elections/4.jpg"
            alt="Manhattan multilingual voting sign"
            width={1200}
            height={800}
            style={{ width: "100%", height: "auto" }}
            loading="lazy"
          />
          <div className="image-caption">
            Manhattan multilingual voting sign
          </div>
        </div>

        <p>
          Moving to Manhattan in the afternoon, I found a different texture but
          the same story. Voting signage in a dozen languages. New York&apos;s
          diversity isn&apos;t an abstraction. It&apos;s printed on the signs
          outside every polling place, a reminder that democracy here means
          making room for everyone.
        </p>

        <blockquote>
          The machinery of democracy is mundane up close. But that mundanity is
          the point.
        </blockquote>

        <p>
          Covering elections as a photojournalist means resisting the urge to
          editorialize through your frame. The story is already there. Your job
          is to not get in the way.
        </p>
      </div>

      <footer className="blog-post-footer">
        <Link href="/blog">&larr; Back to Blog</Link>
      </footer>
    </article>
  );
}
