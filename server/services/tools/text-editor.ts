import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "fs";
import { join, resolve, dirname } from "path";
import type { AnthropicProvider } from "@ai-sdk/anthropic";

interface TextEditorParams {
  command: "view" | "create" | "str_replace" | "insert";
  path: string;
  old_str?: string;
  new_str?: string;
  file_text?: string;
  insert_line?: number;
  insert_text?: string;
  view_range?: [number, number];
}

function resolvePath(basePath: string, filePath: string): string {
  // If the path is already absolute, use it as-is (but ensure it's within basePath)
  const resolved = filePath.startsWith("/")
    ? resolve(filePath)
    : resolve(basePath, filePath);
  return resolved;
}

function viewFile(filePath: string, viewRange?: [number, number]): string {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const stat = statSync(filePath);

  if (stat.isDirectory()) {
    const entries = readdirSync(filePath, { withFileTypes: true });
    return entries
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
      .join("\n");
  }

  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  if (viewRange) {
    const [start, end] = viewRange;
    const startIdx = Math.max(0, start - 1);
    const endIdx = Math.min(lines.length, end);
    return lines
      .slice(startIdx, endIdx)
      .map((line, i) => `${startIdx + i + 1}: ${line}`)
      .join("\n");
  }

  return lines.map((line, i) => `${i + 1}: ${line}`).join("\n");
}

function createFile(filePath: string, fileText: string): string {
  if (existsSync(filePath)) {
    throw new Error(
      `File already exists: ${filePath}. Use str_replace to edit existing files.`,
    );
  }

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, fileText, "utf-8");
  return `File created: ${filePath}`;
}

function strReplace(
  filePath: string,
  oldStr: string,
  newStr: string,
): string {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = readFileSync(filePath, "utf-8");

  // Count occurrences
  const occurrences = content.split(oldStr).length - 1;

  if (occurrences === 0) {
    throw new Error(
      `old_str not found in ${filePath}. Make sure the string matches exactly, including whitespace and indentation.`,
    );
  }

  if (occurrences > 1) {
    throw new Error(
      `Found ${occurrences} matches for old_str in ${filePath}. Provide more context to make the match unique.`,
    );
  }

  const newContent = content.replace(oldStr, newStr);
  writeFileSync(filePath, newContent, "utf-8");

  // Show the edited region with line numbers
  const newLines = newContent.split("\n");
  const replacedLines = newStr.split("\n");
  const startIdx = newContent.indexOf(newStr);
  const startLine =
    newContent.slice(0, startIdx).split("\n").length;
  const endLine = startLine + replacedLines.length - 1;

  // Show a few lines of context around the edit
  const contextStart = Math.max(0, startLine - 3);
  const contextEnd = Math.min(newLines.length, endLine + 3);

  const preview = newLines
    .slice(contextStart, contextEnd)
    .map((line, i) => `${contextStart + i + 1}: ${line}`)
    .join("\n");

  return `Replaced in ${filePath}:\n${preview}`;
}

function insertText(
  filePath: string,
  insertLine: number,
  insertText: string,
): string {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  if (insertLine < 0 || insertLine > lines.length) {
    throw new Error(
      `Line number ${insertLine} is out of range (0-${lines.length}).`,
    );
  }

  const newLines = insertText.split("\n");
  lines.splice(insertLine, 0, ...newLines);

  const newContent = lines.join("\n");
  writeFileSync(filePath, newContent, "utf-8");

  // Show context around insertion
  const contextStart = Math.max(0, insertLine - 2);
  const contextEnd = Math.min(
    lines.length,
    insertLine + newLines.length + 2,
  );

  const preview = lines
    .slice(contextStart, contextEnd)
    .map((line, i) => `${contextStart + i + 1}: ${line}`)
    .join("\n");

  return `Inserted at line ${insertLine} in ${filePath}:\n${preview}`;
}

/**
 * Create a text editor tool scoped to a base directory.
 * Returns the Anthropic provider-defined text editor tool with execute implementation.
 */
export function createTextEditorTool(
  anthropic: AnthropicProvider,
  basePath: string,
) {
  return anthropic.tools.textEditor_20250728({
    execute: async (params: TextEditorParams) => {
      const filePath = resolvePath(basePath, params.path);

      try {
        switch (params.command) {
          case "view":
            return viewFile(filePath, params.view_range);

          case "create":
            if (!params.file_text && params.file_text !== "") {
              return "Error: file_text is required for create command.";
            }
            return createFile(filePath, params.file_text);

          case "str_replace":
            if (params.old_str === undefined) {
              return "Error: old_str is required for str_replace command.";
            }
            if (params.new_str === undefined) {
              return "Error: new_str is required for str_replace command.";
            }
            return strReplace(filePath, params.old_str, params.new_str);

          case "insert":
            if (params.insert_line === undefined) {
              return "Error: insert_line is required for insert command.";
            }
            if (params.insert_text === undefined) {
              return "Error: insert_text is required for insert command.";
            }
            return insertText(
              filePath,
              params.insert_line,
              params.insert_text,
            );

          default:
            return `Error: Unknown command "${params.command}".`;
        }
      } catch (e: any) {
        return `Error: ${e.message}`;
      }
    },
  });
}
