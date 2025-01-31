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

import type { DrawingState } from "@/types";
import { db } from "@/config";
import { updateDrawingState } from "@/mutators";

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
      shapeUtils: [...defaultShapeUtils, SectionShapeUtil, PageShapeUtil, StackShapeUtil],
      bindingUtils: [...defaultBindingUtils, LayoutBindingUtil],
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

    function initDrawing(state: DrawingState) {
      // Migrate container types to page and add bg to sections
      const migratedState = Object.fromEntries(
        Object.entries(state).map(([key, value]) => {
          if (!isShape(value)) return [key, value]
          
          // Rename container to page
          if (value.type === 'container') {
            return [
              key,
              {
                ...value,
                type: 'page',
              }
            ]
          }
          
          // Add default bg and textStyle to sections
          if (value.type === 'section') {
            return [
              key,
              {
                ...value,
                props: {
                  ...value.props,
                  bg: value.props?.bg ?? 'rgba(255,255,255,0.5)',
                  textStyle: value.props?.textStyle ?? 'heading',
                },
              }
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

function isShape(value: InstantTLRecord): value is TLShape {
  return 'type' in value && typeof value.type === 'string'
}

function syncInstantStateToTldrawStore(
  store: TLStore,
  state: DrawingState,
  localSourceId: string
) {
  const migratedUpdates = Object.values(state).map((item) => {
    if (!isShape(item)) return item

    // Migrate section bg and textStyle
    if (item.type === 'section') {
      return {
        ...item,
        props: {
          ...item.props,
          bg: item.props?.bg ?? 'rgba(255,255,255,0.5)',
          textStyle: item.props?.textStyle ?? 'heading',
        },
      }
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
