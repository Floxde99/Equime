import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { Alert } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { useSpaceEyebrow } from '@/lib/useSpaceEyebrow.js';
import {
  createConversation,
  fetchConversationMessages,
  fetchConversations,
  fetchMessageContacts,
  markConversationRead,
  sendMessage,
} from '@/features/engagement/api.js';

export function MessagesPage() {
  const eyebrow = useSpaceEyebrow();
  const qc = useQueryClient();
  const [participantId, setParticipantId] = useState('');
  const [subject, setSubject] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [error, setError] = useState('');

  const { data: contacts = [] } = useQuery({
    queryKey: ['message-contacts'],
    queryFn: fetchMessageContacts,
  });
  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations'],
    queryFn: fetchConversations,
    refetchInterval: 5_000,
  });

  useEffect(() => {
    if (!selectedConversationId && conversations[0]?.id) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );

  const { data: messages = [] } = useQuery({
    queryKey: ['conversation-messages', selectedConversationId],
    queryFn: () => fetchConversationMessages(selectedConversationId),
    enabled: Boolean(selectedConversationId),
    refetchInterval: selectedConversationId ? 5_000 : false,
  });

  useEffect(() => {
    if (selectedConversation?.hasUnread) {
      markConversationRead(selectedConversation.id).then(() => {
        qc.invalidateQueries({ queryKey: ['conversations'] });
      });
    }
  }, [qc, selectedConversation]);

  const createMutation = useMutation({
    mutationFn: createConversation,
    onSuccess: (conversation) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      setSelectedConversationId(conversation.id);
      setParticipantId('');
      setSubject('');
      setError('');
    },
    onError: (err) => setError(err.message),
  });

  const sendMutation = useMutation({
    mutationFn: ({ conversationId, body }) => sendMessage(conversationId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['conversation-messages', selectedConversationId] });
      setMessageBody('');
      setError('');
    },
    onError: (err) => setError(err.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={eyebrow}
        title="Messagerie"
        description="Rafraîchissement automatique toutes les 5 secondes, lecture suivie par participant."
      />

      {error ? <Alert>{error}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Card title="Nouvelle conversation">
          <div className="space-y-4">
            <Select
              label="Contact"
              value={participantId}
              onChange={(e) => setParticipantId(e.target.value)}
              options={[
                { value: '', label: '— Sélectionner —' },
                ...contacts.map((contact) => ({
                  value: contact.id,
                  label: `${contact.firstName} ${contact.lastName} (${contact.role})`,
                })),
              ]}
            />
            <Field label="Sujet" htmlFor="message-subject">
              <Input
                id="message-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Question planning, suivi cavalier..."
              />
            </Field>
            <Button
              type="button"
              disabled={!participantId}
              loading={createMutation.isPending}
              onClick={() => createMutation.mutate({ participantId, subject })}
            >
              Ouvrir la conversation
            </Button>
          </div>

          <div className="mt-6 space-y-3 border-t border-border pt-4">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setSelectedConversationId(conversation.id)}
                className={`w-full rounded-xl border p-3 text-left ${
                  selectedConversationId === conversation.id
                    ? 'border-primary bg-paper'
                    : 'border-border-on-card bg-paper'
                }`}
              >
                <p className="font-sans text-sm font-semibold text-text">
                  {conversation.contacts.map((contact) => `${contact.firstName} ${contact.lastName}`).join(', ')}
                </p>
                <p className="font-sans text-xs text-muted">
                  {conversation.subject || conversation.lastMessage?.body || 'Conversation sans sujet'}
                </p>
                {conversation.hasUnread ? (
                  <p className="mt-1 font-sans text-xs text-info">Nouveaux messages</p>
                ) : null}
              </button>
            ))}
            {conversations.length === 0 ? (
              <p className="font-sans text-sm text-muted">Aucune conversation pour le moment.</p>
            ) : null}
          </div>
        </Card>

        <Card title={selectedConversation ? 'Fil de discussion' : 'Conversation'}>
          {!selectedConversation ? (
            <p className="font-sans text-sm text-muted">
              Sélectionnez ou créez une conversation pour commencer.
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="font-sans text-sm font-semibold text-text">
                  {selectedConversation.contacts
                    .map((contact) => `${contact.firstName} ${contact.lastName}`)
                    .join(', ')}
                </p>
                {selectedConversation.subject ? (
                  <p className="font-sans text-sm text-muted">{selectedConversation.subject}</p>
                ) : null}
              </div>

              <div className="space-y-3">
                {messages.map((message) => (
                  <div key={message.id} className="rounded-xl border border-border-on-card bg-paper p-3">
                    <p className="font-sans text-xs text-muted">
                      {message.sender.firstName} {message.sender.lastName}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap font-sans text-sm text-text">{message.body}</p>
                  </div>
                ))}
              </div>

              <Field label="Votre message" htmlFor="new-message">
                <Textarea
                  id="new-message"
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  rows={4}
                />
              </Field>
              <Button
                type="button"
                disabled={!messageBody.trim()}
                loading={sendMutation.isPending}
                onClick={() =>
                  sendMutation.mutate({
                    conversationId: selectedConversation.id,
                    body: messageBody,
                  })
                }
              >
                Envoyer
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
