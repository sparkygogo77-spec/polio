"use client";
/**
 * The feature library the owner has built up, across every site.
 *
 * Accepted features live here, in this browser's storage under
 * `builder.library`, not in any one site's document: a feature made once is
 * there for every later site. Each is text (manifest, script, README), where
 * it came from, and its shelf picture. Nothing here runs a script; the
 * library hands the list to `works.ts`, which only ever writes scripts into
 * a published site.
 *
 * Offers (new or changed `features/` folders read back from the owner's own
 * repository, `roundTrip.ts`) are held for this visit only, for the review
 * card, and are forgotten when the Builder is reloaded or another site opens.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { setAccepted, type Work, type WorkPicture } from "./works";
import { acceptedWork, type Offer } from "./roundTrip";

interface LibraryState {
  accepted: Work[];
  offers: Offer[];
  /** `owner/name` the offers were read from. */
  offersFrom: string | null;
  /** What the last check of a repository said, in a sentence. */
  says: string | null;
  checking: boolean;
  setOffers: (from: string, offers: Offer[], says: string | null) => void;
  setSays: (says: string | null, checking?: boolean) => void;
  /** Take one offer into the library. Returns the feature, or null when it cannot be accepted. */
  accept: (id: string, picture: WorkPicture | null) => Work | null;
  dismiss: (id: string) => void;
  forget: (id: string) => void;
}

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      accepted: [],
      offers: [],
      offersFrom: null,
      says: null,
      checking: false,
      setOffers: (from, offers, says) => set({ offers, offersFrom: from, says, checking: false }),
      setSays: (says, checking = false) => set({ says, checking }),
      accept: (id, picture) => {
        const o = get().offers.find((x) => x.id === id);
        if (!o || !o.acceptable) return null;
        const w = acceptedWork(o, { from: get().offersFrom ?? "", picture });
        set((s) => ({
          accepted: [...s.accepted.filter((x) => x.manifest.id !== id), w],
          offers: s.offers.filter((x) => x.id !== id),
          says: s.offers.length > 1 ? `${s.offers.length - 1} more to review from ${s.offersFrom}.` : `${w.manifest.name} is in the library.`,
        }));
        return w;
      },
      dismiss: (id) => set((s) => ({ offers: s.offers.filter((x) => x.id !== id), says: s.offers.length > 1 ? s.says : null })),
      forget: (id) => set((s) => ({ accepted: s.accepted.filter((x) => x.manifest.id !== id) })),
    }),
    {
      name: "builder.library",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ accepted: s.accepted }),
      onRehydrateStorage: () => (s) => { if (s) setAccepted(s.accepted); },
    },
  ),
);

/* The works module always sees the library as it stands. */
setAccepted(useLibrary.getState().accepted);
useLibrary.subscribe((s, was) => { if (s.accepted !== was.accepted) setAccepted(s.accepted); });
