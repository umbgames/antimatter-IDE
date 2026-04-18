import React, { useState, useCallback } from 'react';

/**
 * Lightweight markdown renderer for agent chat messages.
 * Handles: code blocks, inline code, bold, italic, headers, lists, links, blockquotes.
 * No external dependencies needed.
 */

interface MarkdownProps {
  content: string;
}

interface CodeBlockProps {
  language: string;
  code: string;
}

function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="md-code-block">
      <div className="md-code-header">
        <span className="md-code-lang">{language || 'text'}</span>
        <button className="md-code-copy" onClick={handleCopy}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className="md-code-pre"><code>{code}</code></pre>
    </div>
  );
}

function parseInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold **text** or __text__
    let match = remaining.match(/^(.*?)\*\*(.+?)\*\*/s);
    if (!match) match = remaining.match(/^(.*?)__(.+?)__/s);
    if (match) {
      if (match[1]) nodes.push(<span key={key++}>{match[1]}</span>);
      nodes.push(<strong key={key++}>{match[2]}</strong>);
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Italic *text* or _text_ (but not inside words for _)
    match = remaining.match(/^(.*?)\*(.+?)\*/s);
    if (match) {
      if (match[1]) nodes.push(<span key={key++}>{match[1]}</span>);
      nodes.push(<em key={key++}>{match[2]}</em>);
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Inline code `code`
    match = remaining.match(/^(.*?)`([^`]+)`/);
    if (match) {
      if (match[1]) nodes.push(<span key={key++}>{match[1]}</span>);
      nodes.push(<code key={key++} className="md-inline-code">{match[2]}</code>);
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Links [text](url)
    match = remaining.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)/);
    if (match) {
      if (match[1]) nodes.push(<span key={key++}>{match[1]}</span>);
      nodes.push(
        <a key={key++} href={match[3]} className="md-link" target="_blank" rel="noopener noreferrer">
          {match[2]}
        </a>
      );
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // No more matches — push the rest
    nodes.push(<span key={key++}>{remaining}</span>);
    break;
  }

  return nodes;
}

export function MarkdownRenderer({ content }: MarkdownProps) {
  // Split content into code blocks and text segments
  const segments: React.ReactNode[] = [];
  let key = 0;

  // Split by code blocks first
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Process text before this code block
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index);
      segments.push(...renderTextBlock(textBefore, key));
      key += 100;
    }

    // Render code block
    segments.push(
      <CodeBlock key={`cb-${key++}`} language={match[1]} code={match[2].trimEnd()} />
    );

    lastIndex = match.index + match[0].length;
  }

  // Process remaining text after last code block
  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex);
    segments.push(...renderTextBlock(remaining, key));
  }

  return <div className="md-content">{segments}</div>;
}

function renderTextBlock(text: string, startKey: number): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let key = startKey;

  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (trimmed === '') {
      i++;
      continue;
    }

    // Headers
    const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const Tag = `h${level}` as keyof JSX.IntrinsicElements;
      nodes.push(
        <Tag key={key++} className={`md-h${level}`}>
          {parseInline(headerMatch[2])}
        </Tag>
      );
      i++;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quoteLines.push(lines[i].trim().slice(2));
        i++;
      }
      nodes.push(
        <blockquote key={key++} className="md-blockquote">
          {parseInline(quoteLines.join(' '))}
        </blockquote>
      );
      continue;
    }

    // Unordered list
    if (/^[-*+]\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s/.test(lines[i])) {
        items.push(lines[i].trim().replace(/^[-*+]\s+/, ''));
        i++;
      }
      nodes.push(
        <ul key={key++} className="md-ul">
          {items.map((item, idx) => (
            <li key={idx}>{parseInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      nodes.push(
        <ol key={key++} className="md-ol">
          {items.map((item, idx) => (
            <li key={idx}>{parseInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      nodes.push(<hr key={key++} className="md-hr" />);
      i++;
      continue;
    }

    // Regular paragraph — collect consecutive non-empty lines
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].trim().startsWith('#') && !lines[i].trim().startsWith('```') && !lines[i].trim().startsWith('> ') && !/^\s*[-*+]\s/.test(lines[i]) && !/^\s*\d+\.\s/.test(lines[i])) {
      paraLines.push(lines[i].trim());
      i++;
    }
    if (paraLines.length > 0) {
      nodes.push(
        <p key={key++} className="md-paragraph">
          {parseInline(paraLines.join(' '))}
        </p>
      );
    }
  }

  return nodes;
}
