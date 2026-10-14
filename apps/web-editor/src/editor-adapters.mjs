function completionStart(linePrefix, lineFrom, item) {
  if (item.replaceLine) {
    const indentation = linePrefix.match(/^\s*/)?.[0].length ?? 0;
    return lineFrom + indentation;
  }
  if (item.replaceFrom !== undefined) return lineFrom + item.replaceFrom;

  const label = item.label.toLowerCase().replace(/\s+/g, " ");
  const possibleStarts = [linePrefix.length];
  for (let i = 0; i < linePrefix.length; i++) {
    if (/\s/.test(linePrefix[i]) && i + 1 < linePrefix.length) possibleStarts.push(i + 1);
  }
  const currentWord = linePrefix.match(/\S+$/);
  if (currentWord) possibleStarts.push(linePrefix.length - currentWord[0].length);
  const matchingStarts = possibleStarts.filter(start => {
    const suffix = linePrefix.slice(start).trim().replace(/\s+/g, " ").toLowerCase();
    return suffix.length > 0 && label.startsWith(suffix);
  });
  return lineFrom + (matchingStarts.length ? Math.min(...matchingStarts) : possibleStarts.at(-1));
}

function completionFilterText(item, query) {
  return item.filterText ?? item.label.split(/[\s,]+/).find(word => word.toLowerCase().startsWith(query));
}

function diagnosticRange(line, diagnostic) {
  const start = Math.min(diagnostic.start, line.length);
  const end = Math.min(Math.max(diagnostic.end, start), line.length);
  return { from: line.from + start, to: line.from + end };
}

export { completionStart, completionFilterText, diagnosticRange };
