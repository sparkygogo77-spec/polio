"use client";
/** Whether J is marking up the Builder (✍️ MARKUP). Nothing here is kept: a mark-up lives until it is sent or left. */
import { create } from "zustand";

export const useMarkup = create<{ on: boolean }>(() => ({ on: false }));
export const openMarkup = () => useMarkup.setState({ on: true });
export const closeMarkup = () => useMarkup.setState({ on: false });
export const toggleMarkup = () => useMarkup.setState((s) => ({ on: !s.on }));
