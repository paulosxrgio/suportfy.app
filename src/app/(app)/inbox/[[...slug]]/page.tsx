import { notFound } from "next/navigation";
import { ConversationView } from "@/features/inbox/conversation-view";
import { InboxPlaceholder } from "@/features/inbox/inbox-placeholder";
import { parseInboxPath } from "@/features/inbox/views";

export default async function InboxPage({ params }: PageProps<"/inbox/[[...slug]]">) {
  const { slug } = await params;
  const route = parseInboxPath(slug);
  if (!route) notFound();
  return route.conversationId ? <ConversationView id={route.conversationId} /> : <InboxPlaceholder />;
}
