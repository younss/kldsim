import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import clsx from "clsx";
import { DOCS, getDoc } from "../docs-content/manifest";

export default function DocsPage() {
  const { slug } = useParams<{ slug: string }>();
  const doc = getDoc(slug);
  const sections = Array.from(new Set(DOCS.map((d) => d.section)));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
      <nav className="space-y-5">
        {sections.map((section) => (
          <div key={section}>
            <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{section}</h3>
            <ul className="space-y-0.5">
              {DOCS.filter((d) => d.section === section).map((d) => (
                <li key={d.slug}>
                  <Link
                    to={`/docs/${d.slug}`}
                    className={clsx(
                      "block rounded-md px-2.5 py-1.5 text-sm",
                      d.slug === doc.slug ? "bg-brand-600/20 text-brand-300" : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
                    )}
                  >
                    {d.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <article className="docs-prose max-w-3xl">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content}</ReactMarkdown>
      </article>
    </div>
  );
}
