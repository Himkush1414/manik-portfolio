import { Fragment, type ReactNode } from "react";
import type { CodeFile } from "@/data/showcaseProjects";

const KEYWORDS = new Set([
  "import", "from", "export", "const", "let", "var", "function", "return",
  "async", "await", "if", "else", "new", "type", "interface", "for", "of",
  "in", "class", "extends", "default", "true", "false", "null", "undefined",
]);

const TOKEN_RE =
  /(\s+)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|([{}()[\].,;:=<>+\-*/&|?!]+)/g;

/** Tiny regex tokeniser — good enough for the demo snippets, no dependency. */
function highlightLine(line: string, keyPrefix: string): ReactNode[] {
  const commentAt = line.indexOf("//");
  const code = commentAt >= 0 ? line.slice(0, commentAt) : line;
  const comment = commentAt >= 0 ? line.slice(commentAt) : "";
  const out: ReactNode[] = [];
  let match: RegExpExecArray | null;
  let k = 0;
  TOKEN_RE.lastIndex = 0;

  while ((match = TOKEN_RE.exec(code))) {
    const [, ws, str, num, word, punc] = match;
    if (ws) {
      out.push(<Fragment key={`${keyPrefix}-${k++}`}>{ws}</Fragment>);
    } else if (str) {
      out.push(<span key={`${keyPrefix}-${k++}`} className="s">{str}</span>);
    } else if (num) {
      out.push(<span key={`${keyPrefix}-${k++}`} className="n">{num}</span>);
    } else if (word) {
      const rest = code.slice(TOKEN_RE.lastIndex);
      const cls = KEYWORDS.has(word)
        ? "k"
        : /^\s*\(/.test(rest)
          ? "f"
          : /^[A-Z]/.test(word)
            ? "t"
            : "v";
      out.push(<span key={`${keyPrefix}-${k++}`} className={cls}>{word}</span>);
    } else if (punc) {
      out.push(<span key={`${keyPrefix}-${k++}`} className="p">{punc}</span>);
    }
  }

  if (comment) {
    out.push(<span key={`${keyPrefix}-c`} className="c">{comment}</span>);
  }
  if (out.length === 0) out.push(<Fragment key={`${keyPrefix}-e`}>{" "}</Fragment>);
  return out;
}

// Dark editor block from the reference: traffic lights, file tabs, line numbers,
// syntax-highlighted placeholder code. The first tab's file is shown.
export default function CodePanel({ files }: { files: CodeFile[] }) {
  const active = files[0];
  const lines = active.code.split("\n");

  return (
    <div className="pd-code">
      <div className="pd-code__bar">
        <span className="pd-code__dot" />
        <span className="pd-code__dot" />
        <span className="pd-code__dot" />
        <span className="pd-code__file">{active.name}</span>
      </div>

      <div className="pd-code__tabs">
        {files.map((file, i) => (
          <span key={file.name} className="pd-code__tab" data-active={i === 0}>
            {file.name}
          </span>
        ))}
      </div>

      <div className="pd-code__scroll">
        {lines.map((line, i) => (
          <div key={i} className="pd-code__line">
            <span className="pd-code__ln">{i + 1}</span>
            <code className="pd-code__text">{highlightLine(line, String(i))}</code>
          </div>
        ))}
      </div>
    </div>
  );
}
