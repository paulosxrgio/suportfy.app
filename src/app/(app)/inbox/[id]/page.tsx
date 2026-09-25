import { ConversationView } from "@/features/inbox/conversation-view";

export default async function ConversationPage({ params }: PageProps<"/inbox/[id]">) {
  const { id } = await params;
  return <ConversationView id={id} />;
}
