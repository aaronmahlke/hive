type DragReorderOptions = {
  /** Transition duration in ms for non-dragged items sliding into place. Default: 200 */
  animation?: number;
};

/**
 * Composable for smooth drag-to-reorder on a horizontal list (e.g. tabs).
 *
 * Usage:
 * ```ts
 * const { containerRef, draggingIndex } = useDragReorder(items)
 * ```
 *
 * Bind `containerRef` to the list wrapper element.
 * Each direct child of that element becomes a draggable item.
 * `draggingIndex` is reactive — use it to style the dragged item.
 */
export function useDragReorder<T>(
  list: Ref<T[]>,
  options: DragReorderOptions = {},
) {
  const { animation = 200 } = options;
  const containerRef = ref<HTMLElement | null>(null);
  const draggingIndex = ref<number | null>(null);

  const easing = "cubic-bezier(0.19, 1, 0.22, 1)";

  // Internal drag state (not reactive — perf-critical, updated every pointermove)
  let startX = 0;
  let dragFrom = -1;
  let currentTarget = -1;
  let colRects: { left: number; width: number; midX: number }[] = [];
  let active = false;
  let didDrag = false;

  function getChildren(): HTMLElement[] {
    if (!containerRef.value) return [];
    return Array.from(containerRef.value.children) as HTMLElement[];
  }

  function cacheRects() {
    const children = getChildren();
    colRects = children.map((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, width: r.width, midX: r.left + r.width / 2 };
    });
  }

  function getTargetIndex(draggedCenterX: number): number {
    let target = dragFrom;

    // Check rightward: swap when dragged center passes the left edge of the next column
    for (let i = dragFrom + 1; i < colRects.length; i++) {
      if (draggedCenterX > colRects[i]!.left) target = i;
      else break;
    }

    // Check leftward (only if we haven't moved right)
    if (target === dragFrom) {
      for (let i = dragFrom - 1; i >= 0; i--) {
        const rightEdge = colRects[i]!.left + colRects[i]!.width;
        if (draggedCenterX < rightEdge) target = i;
        else break;
      }
    }

    return target;
  }

  function applyTransforms(target: number) {
    const children = getChildren();
    const draggedWidth = colRects[dragFrom]?.width ?? 0;

    for (let i = 0; i < children.length; i++) {
      if (i === dragFrom) continue;
      const el = children[i]!;

      let shift = 0;
      if (dragFrom < target) {
        // Dragging right: items between (dragFrom, target] shift left
        if (i > dragFrom && i <= target) shift = -draggedWidth;
      } else if (dragFrom > target) {
        // Dragging left: items between [target, dragFrom) shift right
        if (i >= target && i < dragFrom) shift = draggedWidth;
      }

      el.style.transition = `transform ${animation}ms ${easing}`;
      el.style.transform = shift ? `translateX(${shift}px)` : "";
    }
  }

  function clearTransforms() {
    const children = getChildren();
    for (const el of children) {
      el.style.transition = "";
      el.style.transform = "";
      el.style.position = "";
      el.style.zIndex = "";
    }
  }

  function commitReorder(from: number, to: number) {
    if (from === to) return;
    const updated = [...list.value];
    const [moved] = updated.splice(from, 1);
    if (moved) {
      updated.splice(to, 0, moved);
      list.value = updated;
    }
  }

  function onDragStart(e: DragEvent) {
    e.preventDefault();
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;

    const container = containerRef.value;
    if (!container) return;
    const target = e.target as HTMLElement;

    if (target.closest("button")) return;

    // Find the direct child that was clicked
    let clickedChild: HTMLElement | null = null;
    let node: HTMLElement | null = target;
    while (node && node !== container) {
      if (node.parentElement === container) {
        clickedChild = node;
        break;
      }
      node = node.parentElement;
    }
    if (!clickedChild) return;

    const children = getChildren();
    const index = children.indexOf(clickedChild);
    if (index === -1) return;

    startX = e.clientX;
    dragFrom = index;
    active = false;

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("keydown", onKeyDown);
  }

  function onPointerMove(e: PointerEvent) {
    const deltaX = e.clientX - startX;

    // Dead zone: 4px before activating
    if (!active) {
      if (Math.abs(deltaX) < 4) return;
      active = true;
      didDrag = true;
      draggingIndex.value = dragFrom;
      cacheRects();
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
    }

    // Move dragged element to follow pointer
    const children = getChildren();
    const draggedEl = children[dragFrom];
    if (draggedEl) {
      draggedEl.style.transform = `translateX(${deltaX}px)`;
      draggedEl.style.position = "relative";
      draggedEl.style.zIndex = "10";
      draggedEl.style.transition = "none";
    }

    const draggedCenterX = colRects[dragFrom]!.midX + deltaX;
    const target = getTargetIndex(draggedCenterX);
    if (target !== currentTarget) {
      currentTarget = target;
      applyTransforms(target);
    }
  }

  function animateSettle(finalX: number, onDone: () => void) {
    const children = getChildren();
    const draggedEl = children[dragFrom];
    if (!draggedEl) { onDone(); return; }

    draggedEl.style.transition = `transform ${animation}ms ${easing}`;
    draggedEl.style.transform = finalX ? `translateX(${finalX}px)` : "";

    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      draggedEl.removeEventListener("transitionend", onSettled);
      onDone();
    };
    const onSettled = () => settle();
    draggedEl.addEventListener("transitionend", onSettled);
    setTimeout(settle, animation + 50);
  }

  function onPointerUp() {
    if (!active) {
      cleanup();
      return;
    }

    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("keydown", onKeyDown);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";

    const swapped = dragFrom !== currentTarget && currentTarget !== -1;
    const finalX = swapped
      ? colRects[currentTarget]!.left - colRects[dragFrom]!.left
      : 0;

    animateSettle(finalX, () => {
      if (swapped) commitReorder(dragFrom, currentTarget);
      clearTransforms();
      cleanup();
    });
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      clearTransforms();
      cleanup();
    }
  }

  // Prevent link navigation when a drag just finished
  function onClickCapture(e: MouseEvent) {
    if (didDrag) {
      e.preventDefault();
      e.stopPropagation();
      didDrag = false;
    }
  }

  function cleanup() {
    active = false;
    draggingIndex.value = null;
    dragFrom = -1;
    currentTarget = -1;
    colRects = [];
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("keydown", onKeyDown);
  }

  onMounted(() => {
    containerRef.value?.addEventListener("pointerdown", onPointerDown);
    containerRef.value?.addEventListener("click", onClickCapture, true);
    containerRef.value?.addEventListener("dragstart", onDragStart);
  });

  onUnmounted(() => {
    containerRef.value?.removeEventListener("pointerdown", onPointerDown);
    containerRef.value?.removeEventListener("click", onClickCapture, true);
    containerRef.value?.removeEventListener("dragstart", onDragStart);
    cleanup();
  });

  return { containerRef, draggingIndex };
}
