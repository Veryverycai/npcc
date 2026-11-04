import type { FindQuery } from '@renderer/editor/find';
import {
  FIND_ALL_PER_FILE,
  FIND_ALL_TOTAL,
  findAllInText,
  type FindAllResult,
  type FindFileGroup,
  type FindScope,
} from '@renderer/editor/findAll';
import { useDocs } from '@renderer/store/documents';
import { useUi } from '@renderer/store/ui';

import { documentText } from './actions';

/**
 * Runs "find all" over the active document or over every open tab and shows
 * the hits in the bottom pane. Everything is read from memory, so unsaved
 * edits are searched exactly as they appear in the editor.
 */
export function runFindAll(query: FindQuery, scope: FindScope): FindAllResult | null {
  const ui = useUi.getState();
  if (!query.search) {
    ui.openFind();
    ui.setStatusMessage('请先输入要查找的内容');
    return null;
  }
  ui.setFindQuery(query);

  const { docs, activeId } = useDocs.getState();
  const targets = scope === 'document' ? docs.filter((doc) => doc.id === activeId) : docs;
  const groups: FindFileGroup[] = [];
  let totalHits = 0;
  let truncated = false;

  for (const doc of targets) {
    const remaining = FIND_ALL_TOTAL - totalHits;
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    const text = documentText(doc.id);
    const found = findAllInText(text, query, Math.min(FIND_ALL_PER_FILE, remaining));
    if (found.hits.length === 0) continue;
    totalHits += found.hits.length;
    truncated = truncated || found.truncated;
    groups.push({
      docId: doc.id,
      name: doc.name,
      path: doc.path,
      hits: found.hits,
      truncated: found.truncated,
    });
  }

  const result: FindAllResult = {
    scope,
    query,
    groups,
    totalHits,
    truncated,
    searchedDocuments: targets.length,
  };
  ui.setFindResults(result);
  ui.setStatusMessage(
    totalHits === 0
      ? `未找到「${query.search}」`
      : `「${query.search}」：${groups.length} 个文件 / ${totalHits} 处`,
  );
  return result;
}

/** Re-runs the last query against the given scope, used by the Search menu. */
export function repeatFindAll(scope: FindScope): void {
  const ui = useUi.getState();
  const result = runFindAll(ui.findQuery, scope);
  if (!result) ui.openFind();
}
