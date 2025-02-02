import { useEffect, useState } from "react";
import { omitBy, throttle } from "lodash";
import {
  createTLSchema,
  loadSnapshot,
  HistoryEntry,
  TLRecord,
  TLStoreWithStatus,
  createTLStore,
  defaultShapeUtils,
  defaultBindingUtils,
  uniqueId,
  TLShapeId,
  TLStore,
  TLShape,
} from "tldraw";
import { SectionShapeUtil } from '@/components/SectionTool'
import { PageShapeUtil } from '@/components/PageTool'
import { LayoutBindingUtil } from '@/components/LayoutBindingUtil'
import { StackShapeUtil } from '@/components/StackTool'
import { FrameShapeUtil, FrameLayoutBindingUtil } from '@/components/FrameTool'

import type { DrawingState } from "@/types";
import { db } from "@/config";
import { updateDrawingState } from "@/mutators";

// Add a migration function to handle existing frames
function migrateShape(value: any): any {
  if (!isShape(value)) return value;
  
  // Migrate frame shapes to include layoutMode
  if (value.type === 'custom-frame') {
    return {
      ...value,
      props: {
        ...value.props,
        layoutMode: value.props.layoutMode || 'none',
        padding: value.props.padding || 16,
      },
    };
  }
  
  return value;
}

export function useInstantStore({
  drawingId,
  localSourceId,
}: {
  drawingId: string | null;
  localSourceId: string;
}) {
  const [storeWithStatus, setStoreWithStatus] = useState<TLStoreWithStatus>({
    status: "loading",
  });

  useEffect(() => {
    if (!drawingId) return;
    const _drawingId = drawingId;

    // --- begin: throttling
    let pendingState: DrawingState = {};
    const sp = new URL(location.href).searchParams;

    // Use different throttle times for different operations
    const DRAG_THROTTLE = 16; // ~60fps for smooth dragging
    const DEFAULT_THROTTLE = 200; // default for other operations

    // Get operation type from the state
    const isDraggingOperation = (state: DrawingState) => {
      return Object.values(state).some(record => 
        record?.meta?.isTransforming || // Check for active transforms
        record?.meta?.isDragging
      );
    };

    // Dynamic throttle based on operation
    function getThrottleTime(state: DrawingState) {
      if (isDraggingOperation(state)) {
        return DRAG_THROTTLE;
      }
      return sp.has("x_throttle") 
        ? parseInt(String(sp.get("x_throttle"))) || DEFAULT_THROTTLE 
        : DEFAULT_THROTTLE;
    }

    // Create throttled sync functions with dynamic wait times
    function createDynamicThrottle(fn: Function) {
      const throttled = {} as Record<number, Function>;
      return (state: DrawingState) => {
        const wait = getThrottleTime(state);
        if (!throttled[wait]) {
          throttled[wait] = throttle(fn, wait, { leading: true, trailing: true });
        }
        return throttled[wait];
      };
    }

    const getDynamicSync = createDynamicThrottle(runSync);

    function sync(state: DrawingState) {
      pendingState = { ...pendingState, ...state };
      getDynamicSync(state)();
    }

    function runSync() {
      updateDrawingState({ drawingId: _drawingId, state: pendingState });
      pendingState = {};
    }

    // --- end: throttling

    // Add throttling to remote syncing as well
    // This throttled function wraps syncInstantStateToTldrawStore
    const throttledRemoteSync = createDynamicThrottle(
      (tlStore: TLStore, state: DrawingState, localSourceId: string) => {
        syncInstantStateToTldrawStore(tlStore, state, localSourceId);
      }
    );

    let lifecycleState: "pending" | "ready" | "closed" = "pending";
    const unsubs: (() => void)[] = [];
    const tlStore = createTLStore({
      shapeUtils: [
        ...defaultShapeUtils,
        FrameShapeUtil,
      ],
      bindingUtils: [
        ...defaultBindingUtils,
        FrameLayoutBindingUtil,
      ],
    });

    db._core.subscribeQuery(
      {
        drawings: {
          $: {
            where: {
              id: drawingId,
            },
          },
        },
      },
      (res) => {
        const state =
          res.data?.drawings?.find((c) => c.id === drawingId)?.state ?? {};

        if (lifecycleState === "pending") {
          initDrawing(state);
        } else if (lifecycleState === "ready") {
          // Instead of calling syncInstantStateToTldrawStore directly,
          // use the throttled version to optimize remote syncing.
          throttledRemoteSync(tlStore, state, localSourceId);
        }
      }
    );

    return teardown;

    function handleLocalChange(event: HistoryEntry<TLRecord>) {
      if (event.source !== "user") return;
      sync(tldrawEventToStateSlice(event, localSourceId));
    }

    function initDrawing(state: DrawingState) {
      // Migrate container types to page and add bg to sections
      const migratedState = Object.fromEntries(
        Object.entries(state).map(([key, value]) => {
          return [key, migrateShape(value)];
        })
      );

      unsubs.push(
        tlStore.listen(handleLocalChange, {
          source: "user",
          scope: "document",
        })
      );

      tlStore.mergeRemoteChanges(() => {
        loadSnapshot(tlStore, {
          document: {
            store: omitBy(migratedState, (v) => v === null || v.meta.deleted) as Record<
              string,
              TLRecord
            >,
            schema: createTLSchema().serialize(),
          },
        });
      });

      setStoreWithStatus({
        status: "synced-remote",
        connectionStatus: "online",
        store: tlStore,
      });

      lifecycleState = "ready";
    }

    function teardown() {
      setStoreWithStatus({
        status: "not-synced",
        store: tlStore,
      });

      unsubs.forEach((u) => u());

      lifecycleState = "closed";
    }
  }, [drawingId]);

  return storeWithStatus;
}

function tldrawEventToStateSlice(
  event: HistoryEntry<TLRecord>,
  localSourceId: string
) {
  const state: DrawingState = {};

  const items = [
    ...Object.values(event.changes.added),
    ...Object.values(event.changes.updated).map(([_, next]) => next),
  ];

  for (const item of items) {
    state[item.id] = {
      ...item,
      meta: {
        source: localSourceId,
        version: uniqueId(),
      },
    };
  }

  for (const item of Object.values(event.changes.removed)) {
    state[item.id] = {
      ...item,
      meta: {
        source: localSourceId,
        version: uniqueId(),
        deleted: true,
      },
    };
  }

  return state;
}

function isShape(value: InstantTLRecord): value is TLShape {
  return 'type' in value && typeof value.type === 'string'
}

function syncInstantStateToTldrawStore(
  store: TLStore,
  state: DrawingState,
  localSourceId: string
) {
  if (Object.keys(state).length === 0) return;

  store.mergeRemoteChanges(() => {
    const removeIds = [];
    const updates = [];

    for (const item of Object.values(state)) {
      if (!item) continue;

      if (item.meta.deleted && store.has(item.id)) {
        removeIds.push(item.id);
        continue;
      }

      const tlItem = store.get(item.id as TLShapeId);
      if (tlItem && 
          tlItem.meta.version === item.meta.version && 
          item.meta.source === localSourceId) {
        continue;
      }

      updates.push(item);
    }

    if (updates.length) {
      store.put(updates as TLRecord[]);
    }

    if (removeIds.length) {
      store.remove(removeIds as TLShapeId[]);
    }
  });
}
