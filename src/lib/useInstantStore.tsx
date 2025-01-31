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
  TLBaseShape,
  BaseBoxShape,
} from "tldraw";
import { BuilderShapeUtil } from '@/components/BuilderTool'

import type { DrawingState } from "@/types";
import { db } from "@/config";
import { updateDrawingState } from "@/mutators";

// Define types for legacy shapes that need migration
interface LegacyShapeProps {
  text?: string;
  content?: string;
  width?: number;
  height?: number;
}

type LegacyShape = BaseBoxShape<string, LegacyShapeProps> & {
  x?: number;
  y?: number;
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
    // We can set a throttle wait time by adding `?x_throttle=100` to the URL
    // We default to 200ms
    // Setting `x_throttle=0` will bypass throttling
    let pendingState: DrawingState = {};
    const sp = new URL(location.href).searchParams;
    const throttleWaitMs = sp.has("x_throttle")
      ? parseInt(String(sp.get("x_throttle"))) || 0
      : 200;
    const enqueueSync = throttleWaitMs
      ? throttle(runSync, throttleWaitMs, {
          leading: true,
          trailing: true,
        })
      : runSync;

    function sync(state: DrawingState) {
      pendingState = { ...pendingState, ...state };
      enqueueSync();
    }

    function runSync() {
      updateDrawingState({ drawingId: _drawingId, state: pendingState });
      pendingState = {};
    }

    // --- end: throttling
    let lifecycleState: "pending" | "ready" | "closed" = "pending";
    const unsubs: (() => void)[] = [];
    const tlStore = createTLStore({
      shapeUtils: [...defaultShapeUtils, BuilderShapeUtil],
      bindingUtils: [...defaultBindingUtils],
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
          syncInstantStateToTldrawStore(tlStore, state, localSourceId);
        }
      }
    );

    return teardown;

    function handleLocalChange(event: HistoryEntry<TLRecord>) {
      if (event.source !== "user") return;
      sync(tldrawEventToStateSlice(event, localSourceId));
    }

    function initDrawing(state: Record<string, LegacyShape>) {
      const migratedState = Object.fromEntries(
        Object.entries(state).map(([key, value]) => {
          if (!value) return [key, value];

          if (value.type === 'builder' || value.type === 'container' || value.type === 'section' || value.type === 'stack') {
            const width = typeof value.w === 'number' ? value.w : 
                         typeof value.props?.w === 'number' ? value.props.w : 200;
            const height = typeof value.h === 'number' ? value.h : 
                          typeof value.props?.h === 'number' ? value.props.h : 50;

            return [
              key,
              {
                id: value.id,
                typeName: 'shape',
                type: 'builder',
                parentId: value.parentId,
                index: value.index,
                x: typeof value.x === 'number' ? value.x : (1200 - 200) / 2,
                y: typeof value.y === 'number' ? value.y : 100,
                rotation: 0,
                isLocked: false,
                opacity: 1,
                props: {
                  text: value.props?.text || value.props?.content || 'New todo',
                  isComplete: false,
                },
                meta: value.meta || {},
                // BaseBoxShape properties
                size: {
                  w: width,
                  h: height,
                },
              } as TLShape
            ]
          }
          return [key, value]
        })
      )

      unsubs.push(
        tlStore.listen(handleLocalChange, {
          source: "user",
          scope: "document",
        })
      )

      tlStore.mergeRemoteChanges(() => {
        loadSnapshot(tlStore, {
          document: {
            store: omitBy(migratedState, (v) => v === null || v.meta.deleted) as Record<
              string,
              TLRecord
            >,
            schema: createTLSchema().serialize(),
          },
        })
      })

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

function syncInstantStateToTldrawStore(
  store: TLStore,
  state: Record<string, LegacyShape>,
  localSourceId: string
) {
  const migratedUpdates = Object.values(state).map((item) => {
    if (!item) return item;

    if (item.type === 'builder' || item.type === 'container' || item.type === 'section' || item.type === 'stack') {
      const width = typeof item.w === 'number' ? item.w : 
                   typeof item.props?.w === 'number' ? item.props.w : 200;
      const height = typeof item.h === 'number' ? item.h : 
                    typeof item.props?.h === 'number' ? item.props.h : 50;

      return {
        id: item.id,
        typeName: 'shape',
        type: 'builder',
        parentId: item.parentId,
        index: item.index,
        x: typeof item.x === 'number' ? item.x : (1200 - 200) / 2,
        y: typeof item.y === 'number' ? item.y : 100,
        rotation: 0,
        isLocked: false,
        opacity: 1,
        props: {
          text: item.props?.text || item.props?.content || 'New todo',
          isComplete: false,
        },
        meta: item.meta || {},
        // BaseBoxShape properties
        size: {
          w: width,
          h: height,
        },
      } as TLShape
    }
    return item
  })

  store.mergeRemoteChanges(() => {
    const removeIds = Object.values(state)
      .filter((e) => e?.meta.deleted && store.has(e.id))
      .map((e) => e!.id)

    const updates = migratedUpdates.filter((item) => {
      if (!item) return false
      if (item.meta.deleted) return false

      const tlItem = store.get(item?.id as TLShapeId)
      const diffVersion = tlItem?.meta.version !== item?.meta.version
      const diffSource = item?.meta.source !== localSourceId

      return diffSource && diffVersion
    })

    if (updates.length) {
      store.put(updates as TLRecord[])
    }

    if (removeIds.length) {
      store.remove(removeIds as TLShapeId[])
    }
  })
}
