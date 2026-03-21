'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Input } from '@faithflow-ai/ui';
import { trpc } from '../../../lib/trpc';

type MessageAttachment = { url: string; name?: string; type?: string; assetId?: string };

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return '—';
  return (typeof value === 'string' ? new Date(value) : value).toLocaleString();
};

export default function MessagesPage() {
  const utils = trpc.useUtils();
  const { data: selfProfile } = trpc.member.selfProfile.useQuery(undefined, { retry: false });
  const churchId = selfProfile?.member?.churchId;

  const { data: directory } = trpc.member.directory.useQuery(
    { churchId, viewer: 'MEMBER' },
    { enabled: Boolean(churchId) }
  );

  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [newConversationMemberId, setNewConversationMemberId] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingIdleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastConversationRef = useRef<string | null>(null);

  const { data: conversations } = trpc.messaging.listConversations.useQuery(undefined, {
    enabled: Boolean(selfProfile),
  });
  const { data: messages } = trpc.messaging.listMessages.useQuery(
    { conversationId: selectedConversationId, limit: 50 },
    { enabled: Boolean(selectedConversationId) }
  );
  const { data: typingStatus } = trpc.messaging.typingStatus.useQuery(
    { conversationId: selectedConversationId },
    { enabled: Boolean(selectedConversationId) }
  );
  const { data: readStatus } = trpc.messaging.readStatus.useQuery(
    { conversationId: selectedConversationId },
    { enabled: Boolean(selectedConversationId) }
  );

  const { mutate: sendMessage } = trpc.messaging.sendMessage.useMutation({
    onSuccess: async () => {
      setMessageBody('');
      setAttachmentUrl('');
      setAttachmentName('');
      setPendingAttachments([]);
      if (selectedConversationId) {
        await utils.messaging.listMessages.invalidate();
      }
    },
  });
  const { mutate: setTyping } = trpc.messaging.setTyping.useMutation();
  const { mutate: markConversationRead } = trpc.messaging.markConversationRead.useMutation();
  const { mutate: createDirect } = trpc.messaging.createDirect.useMutation({
    onSuccess: async () => {
      setNewConversationMemberId('');
      await Promise.all([
        utils.messaging.listConversations.invalidate(),
        utils.messaging.listMessages.invalidate(),
      ]);
    },
  });
  const { mutateAsync: createUpload } = trpc.storage.createUpload.useMutation();

  useEffect(() => {
    if (!selectedConversationId && conversations?.length) {
      setSelectedConversationId(conversations[0].conversation.id);
    }
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    const previous = lastConversationRef.current;
    if (previous && previous !== selectedConversationId) {
      setTyping({ conversationId: previous, typing: false });
    }
    lastConversationRef.current = selectedConversationId || null;
  }, [selectedConversationId, setTyping]);

  useEffect(() => {
    if (!selectedConversationId) return;
    markConversationRead({ conversationId: selectedConversationId });
  }, [markConversationRead, messages?.[0]?.id, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (typingIdleRef.current) clearTimeout(typingIdleRef.current);

    const hasContent = Boolean(messageBody.trim());
    typingTimeoutRef.current = setTimeout(() => {
      setTyping({ conversationId: selectedConversationId, typing: hasContent });
    }, 300);

    if (hasContent) {
      typingIdleRef.current = setTimeout(() => {
        setTyping({ conversationId: selectedConversationId, typing: false });
      }, 2000);
    }

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (typingIdleRef.current) clearTimeout(typingIdleRef.current);
    };
  }, [messageBody, selectedConversationId, setTyping]);

  const otherTyping = useMemo(
    () => (typingStatus ?? []).filter((entry) => entry.memberId !== selfProfile?.member?.id),
    [typingStatus, selfProfile?.member?.id]
  );

  const otherReadStatus = useMemo(
    () => (readStatus ?? []).filter((entry) => entry.memberId !== selfProfile?.member?.id),
    [readStatus, selfProfile?.member?.id]
  );

  const addAttachment = () => {
    const url = attachmentUrl.trim();
    if (!url) return;
    setPendingAttachments((prev) => {
      if (prev.some((e) => e.url === url)) return prev;
      return [...prev, { url, name: attachmentName.trim() || undefined }];
    });
    setAttachmentUrl('');
    setAttachmentName('');
  };

  const removeAttachment = (url: string) =>
    setPendingAttachments((prev) => prev.filter((e) => e.url !== url));

  const handleAttachmentFile = async (file?: File | null) => {
    if (!file || uploadingAttachment) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      alert('File exceeds the 10 MB limit.');
      return;
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      alert('File type not allowed. Supported: images, PDF, Word documents, plain text.');
      return;
    }
    setUploadingAttachment(true);
    try {
      const upload = await createUpload({
        filename: file.name,
        contentType: file.type,
        size: file.size,
        purpose: 'message-attachments',
        churchId: churchId ?? undefined,
      });
      await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      setPendingAttachments((prev) => [
        ...prev,
        {
          url: upload.publicUrl,
          name: file.name,
          type: file.type || undefined,
          assetId: upload.assetId,
        },
      ]);
    } catch {
      // Silently fail — user already sees the upload state reset
    } finally {
      setUploadingAttachment(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-6">
        <h2 className="text-base font-semibold">Messages</h2>
        <p className="mt-1 text-sm text-muted">Chat with church staff or other members.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <select
            className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
            value={selectedConversationId}
            onChange={(e) => setSelectedConversationId(e.target.value)}
          >
            <option value="">Select conversation</option>
            {conversations?.map((entry) => (
              <option key={entry.conversation.id} value={entry.conversation.id}>
                {entry.conversation.name ?? 'Direct conversation'}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-10 flex-1 rounded-md border border-border bg-white px-3 text-sm"
              value={newConversationMemberId}
              onChange={(e) => setNewConversationMemberId(e.target.value)}
            >
              <option value="">Start new conversation</option>
              {directory
                ?.filter((m) => m.id !== selfProfile?.member?.id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.preferredName ?? m.firstName} {m.lastName}
                  </option>
                ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (newConversationMemberId) createDirect({ memberId: newConversationMemberId });
              }}
              disabled={!newConversationMemberId}
            >
              Start
            </Button>
          </div>
        </div>

        {/* Message thread */}
        <div className="mt-4 max-h-72 space-y-2 overflow-y-auto rounded-md border border-border p-3">
          {messages
            ?.slice()
            .reverse()
            .map((message) => (
              <div key={message.id} className="rounded-md border border-border p-2">
                <p className="text-xs text-muted">
                  {message.senderType === 'MEMBER' ? 'Member' : 'Staff'} ·{' '}
                  {formatDateTime(message.createdAt)}
                </p>
                <p className="mt-1 text-sm">{message.body}</p>
                {Array.isArray(message.attachments) && message.attachments.length ? (
                  <div className="mt-2 space-y-1 text-xs text-muted">
                    {(message.attachments as MessageAttachment[]).map((attachment) => {
                      // Only render https:// links to avoid javascript: or data: URIs
                      const isSafe = attachment.url?.startsWith('https://');
                      return isSafe ? (
                        <a
                          key={attachment.url}
                          href={attachment.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="block truncate text-primary underline"
                        >
                          {attachment.name ?? attachment.url}
                        </a>
                      ) : null;
                    })}
                  </div>
                ) : null}
              </div>
            ))}
          {!messages?.length ? <p className="text-sm text-muted">No messages yet.</p> : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          {otherTyping.length ? (
            <span>{otherTyping.map((e) => e.name).join(', ')} typing...</span>
          ) : null}
          {otherReadStatus.length ? (
            <span>
              Last read:{' '}
              {otherReadStatus
                .map((e) => `${e.name} ${e.lastReadAt ? formatDateTime(e.lastReadAt) : '—'}`)
                .join(', ')}
            </span>
          ) : null}
        </div>

        {/* Send */}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Write a message"
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
          />
          <Button
            onClick={() => {
              if (selectedConversationId && messageBody.trim()) {
                const pending = pendingAttachments.length
                  ? pendingAttachments
                  : attachmentUrl.trim()
                    ? [{ url: attachmentUrl.trim(), name: attachmentName.trim() || undefined }]
                    : undefined;
                sendMessage({
                  conversationId: selectedConversationId,
                  body: messageBody.trim(),
                  attachments: pending,
                });
              }
            }}
            disabled={!selectedConversationId || !messageBody.trim()}
          >
            Send
          </Button>
        </div>

        {/* Attachments */}
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <Input
            placeholder="Attachment URL"
            value={attachmentUrl}
            onChange={(e) => setAttachmentUrl(e.target.value)}
          />
          <Input
            placeholder="Label (optional)"
            value={attachmentName}
            onChange={(e) => setAttachmentName(e.target.value)}
          />
          <Button variant="outline" onClick={addAttachment} disabled={!attachmentUrl.trim()}>
            Add attachment
          </Button>
          <Input
            type="file"
            disabled={uploadingAttachment}
            onChange={(e) => handleAttachmentFile(e.target.files?.[0])}
          />
        </div>
        {pendingAttachments.length ? (
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
            {pendingAttachments.map((attachment) => (
              <div
                key={attachment.url}
                className="flex items-center gap-2 rounded-md border border-border px-2 py-1"
              >
                <span className="truncate">{attachment.name ?? attachment.url}</span>
                <Button size="sm" variant="outline" onClick={() => removeAttachment(attachment.url)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
