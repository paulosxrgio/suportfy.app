import type { Metadata } from "next";
import { InboxShell } from "@/features/inbox/inbox-shell";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxLayout({ children }: LayoutProps<"/inbox">) {
  return <InboxShell>{children}</InboxShell>;
}
