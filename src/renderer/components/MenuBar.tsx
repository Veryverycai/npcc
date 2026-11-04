import { useEffect, useMemo, useRef, useState } from 'react';

import { menuModel, type MenuNode, type MenuGroup } from '@renderer/app/menuModel';
import { runCommand } from '@renderer/app/commands';
import { useDocs } from '@renderer/store/documents';
import { useSettings } from '@renderer/store/settings';
import { useUi } from '@renderer/store/ui';

/** Which flyout is open: the top-level group, plus the submenu item's label. */
interface OpenState {
  group: string;
  sub: string | null;
}

/**
 * Notepad++-style menu bar drawn in the DOM. The native Win32 menu cannot pick
 * up the editor palette, so the bar, its flyouts and their check marks are all
 * rendered here; every entry dispatches the same command ids as before.
 */
export function MenuBar() {
  const settings = useSettings((state) => state.settings);
  const docs = useDocs((state) => state.docs);
  const activeId = useDocs((state) => state.activeId);
  const recent = useUi((state) => state.recent);
  const split = useUi((state) => state.split);
  const overwrite = useUi((state) => state.overwrite);
  const [open, setOpen] = useState<OpenState | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const activeDoc = docs.find((doc) => doc.id === activeId) ?? null;

  const groups: MenuGroup[] = useMemo(
    () =>
      menuModel({
        settings,
        doc: activeDoc
          ? {
              encoding: activeDoc.encoding,
              eol: activeDoc.eol,
              languageId: activeDoc.languageId,
            }
          : null,
        recent,
        split,
        overwrite,
      }),
    [settings, activeDoc, recent, split, overwrite],
  );

  // Escape and clicking outside both close the menu, like the native bar.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent): void => {
      if (barRef.current?.contains(event.target as Node)) return;
      setOpen(null);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(null);
      }
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const activate = (node: MenuNode): void => {
    if (node.type !== 'item' || node.disabled) return;
    setOpen(null);
    void runCommand(node.id);
  };

  const renderItems = (items: MenuNode[], group: string, nested: boolean) => (
    <div className={nested ? 'menu-flyout menu-flyout-nested' : 'menu-flyout'} role="menu">
      {items.map((node, index) => {
        if (node.type === 'separator') {
          return (
            <div key={`sep-${group}-${index}`} className="menu-separator" role="separator" />
          );
        }
        if (node.type === 'submenu') {
          const subOpen = open?.group === group && open.sub === node.label;
          return (
            <div
              key={`${group}-${node.label}`}
              className={`menu-entry menu-entry-parent${subOpen ? ' is-open' : ''}`}
              role="menuitem"
              tabIndex={0}
              onMouseEnter={() => setOpen({ group, sub: node.label })}
              onClick={() => setOpen({ group, sub: node.label })}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === 'ArrowRight') {
                  event.preventDefault();
                  setOpen({ group, sub: node.label });
                }
              }}
            >
              <span className="menu-check" aria-hidden>
                {''}
              </span>
              <span className="menu-label">{node.label}</span>
              <span className="menu-accel" aria-hidden>
                ▸
              </span>
              {subOpen && renderItems(node.items, `${group}/${node.label}`, true)}
            </div>
          );
        }
        return (
          <button
            key={`${group}-${node.id}`}
            type="button"
            role="menuitem"
            className="menu-entry"
            disabled={node.disabled}
            onClick={() => activate(node)}
          >
            <span className="menu-check" aria-hidden>
              {node.checked ? '✓' : ''}
            </span>
            <span className="menu-label">{node.label}</span>
            <span className="menu-accel" aria-hidden>
              {node.accel ?? ''}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="menu-bar" role="menubar" ref={barRef}>
      {groups.map((group) => {
        const isOpen = open?.group === group.label;
        return (
          <div key={group.label} className="menu-root">
            <button
              type="button"
              role="menuitem"
              aria-haspopup="true"
              aria-expanded={isOpen}
              className={`menu-title${isOpen ? ' is-open' : ''}`}
              onClick={() => setOpen(isOpen ? null : { group: group.label, sub: null })}
              onMouseEnter={() => {
                // Once a menu is open, hovering the bar walks between groups.
                if (open) setOpen({ group: group.label, sub: null });
              }}
            >
              {group.label}
            </button>
            {isOpen && renderItems(group.items, group.label, false)}
          </div>
        );
      })}
    </div>
  );
}
