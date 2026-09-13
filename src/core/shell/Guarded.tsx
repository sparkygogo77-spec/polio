"use client";
/**
 * One contributed control, kept from taking the app with it.
 *
 * The shell renders whatever the registry holds, and a feature's component is
 * not the shell's code: a mistake in one of them — a field read off a reply
 * that did not have it, most likely — throws during render, and React's
 * answer to an unhandled render error is to unmount the whole tree. That is
 * a blank Builder because a status route answered oddly, which is a blast
 * radius out of all proportion to the fault. Measured, before this existed:
 * a `{}` from the publish route left two buttons on the page.
 *
 * So each contributed item renders inside one of these. If it throws, that
 * item is dropped and everything else stands. It is deliberately silent on
 * the screen and loud in the console: a missing icon in the top bar is not
 * worth an alarm, and a developer needs the stack.
 *
 * This is not a licence to skip the guard clause. It is the floor under the
 * ones that get missed.
 */
import * as React from "react";

interface Props {
  /** What this is, so the console line names it. */
  id: string;
  children: React.ReactNode;
}

export class Guarded extends React.Component<Props, { dead: boolean }> {
  constructor(props: Props) {
    super(props);
    this.state = { dead: false };
  }

  static getDerivedStateFromError() {
    return { dead: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error(`[shell] "${this.props.id}" threw and was dropped from the bar.`, error, info?.componentStack);
  }

  render() {
    return this.state.dead ? null : this.props.children;
  }
}
