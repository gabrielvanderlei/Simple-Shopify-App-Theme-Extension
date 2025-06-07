import { useState, useEffect, useRef } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  TextField,
  InlineStack,
  Banner,
  Avatar,
  Box,
  Spinner,
  Badge,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  return json({
    shopDomain: session.shop
  });
};

export default function ChatPage() {
  const { shopDomain } = useLoaderData<typeof loader>();

  // Estados
  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [shopConfig, setShopConfig] = useState<any>(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Carregar dados ao montar
  useEffect(() => {
    loadChatData();
  }, []);

  // Auto scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadChatData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/chat');
      const data = await response.json();
      
      if (data.success) {
        setIsConfigured(data.isConfigured);
        setRecentChats(data.recentChats);
        setShopConfig(data.shopConfig);
      }
    } catch (error) {
      console.error('Load chat data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!question.trim() || sending) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: question,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentQuestion = question;
    setQuestion("");
    setSending(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: currentQuestion })
      });

      const data = await response.json();
      
      if (data.success) {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: data.answer,
          timestamp: data.timestamp
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        
        // Atualizar histórico
        loadChatData();
      } else {
        // Mostrar erro como mensagem do assistente
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: `Error: ${data.error}`,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Send message error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: "Sorry, I encountered an error processing your request.",
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  if (loading) {
    return (
      <Page>
        <TitleBar title="AI Store Assistant" />
        <Card>
          <BlockStack gap="300" align="center">
            <Spinner size="large" />
            <Text as="p" variant="bodyMd">Loading chat...</Text>
          </BlockStack>
        </Card>
      </Page>
    );
  }

  if (!isConfigured) {
    return (
      <Page>
        <TitleBar title="AI Store Assistant" />
        <Banner tone="warning">
          <BlockStack gap="200">
            <Text as="p">
              <strong>Configuration Required:</strong> Please configure your OpenAI API key first.
            </Text>
            <Button url="/app/config" variant="primary">
              Go to Configuration
            </Button>
          </BlockStack>
        </Banner>
      </Page>
    );
  }

  return (
    <Page>
      <TitleBar title="AI Store Assistant" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">
                  Chat with your AI Assistant
                </Text>
                <InlineStack gap="200">
                  <Badge tone="success">Online</Badge>
                  {messages.length > 0 && (
                    <Button variant="plain" onClick={clearChat}>
                      Clear Chat
                    </Button>
                  )}
                </InlineStack>
              </InlineStack>

              <Text as="p" variant="bodyMd" tone="subdued">
                Store: {shopDomain} | Model: GPT-3.5 Turbo
              </Text>

              {/* Chat Area */}
              <Box
                minHeight="500px"
                maxHeight="500px"
                padding="400"
                background="bg-surface-secondary"
                borderRadius="200"
                overflowY="scroll"
              >
                <BlockStack gap="300">
                  {messages.length === 0 && (
                    <Box padding="400" textAlign="center">
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Start a conversation! Ask me anything about your store.
                      </Text>
                      <BlockStack gap="200" padding="400">
                        <Text as="p" variant="bodyMd">
                          <strong>Try asking:</strong>
                        </Text>
                        <Text as="p" variant="bodyMd" tone="subdued">
                          • "What are my top-selling products?"
                        </Text>
                        <Text as="p" variant="bodyMd" tone="subdued">
                          • "How is my store performing?"
                        </Text>
                        <Text as="p" variant="bodyMd" tone="subdued">
                          • "What should I focus on to increase sales?"
                        </Text>
                        <Text as="p" variant="bodyMd" tone="subdued">
                          • "Analyze my recent orders"
                        </Text>
                      </BlockStack>
                    </Box>
                  )}

                  {messages.map((message) => (
                    <InlineStack key={message.id} align={message.type === 'user' ? 'end' : 'start'}>
                      <Box
                        maxWidth="70%"
                        padding="300"
                        background={message.type === 'user' ? 'bg-fill-brand' : 'bg-surface'}
                        borderRadius="200"
                        borderWidth="025"
                        borderColor="border"
                      >
                        <InlineStack gap="200" align="start">
                          <Avatar
                            size="small"
                            name={message.type === 'user' ? 'You' : 'AI Assistant'}
                            initials={message.type === 'user' ? 'U' : 'AI'}
                          />
                          <BlockStack gap="100">
                            <Text
                              as="p"
                              variant="bodyMd"
                              tone={message.type === 'user' ? 'text-inverse' : 'base'}
                            >
                              {message.content}
                            </Text>
                            <Text
                              as="p"
                              variant="bodySm"
                              tone={message.type === 'user' ? 'text-inverse-secondary' : 'subdued'}
                            >
                              {new Date(message.timestamp).toLocaleTimeString()}
                            </Text>
                          </BlockStack>
                        </InlineStack>
                      </Box>
                    </InlineStack>
                  ))}

                  {sending && (
                    <InlineStack align="start">
                      <Box
                        padding="300"
                        background="bg-surface"
                        borderRadius="200"
                        borderWidth="025"
                        borderColor="border"
                      >
                        <InlineStack gap="200" align="center">
                          <Avatar size="small" name="AI Assistant" initials="AI" />
                          <Spinner size="small" />
                          <Text as="p" variant="bodyMd">
                            Thinking...
                          </Text>
                        </InlineStack>
                      </Box>
                    </InlineStack>
                  )}

                  <div ref={messagesEndRef} />
                </BlockStack>
              </Box>

              {/* Input Area */}
              <InlineStack gap="200">
                <div style={{ flex: 1 }}>
                  <TextField
                    label=""
                    value={question}
                    onChange={setQuestion}
                    onKeyDown={handleKeyPress}
                    placeholder="Ask me anything about your store..."
                    multiline={2}
                    autoComplete="off"
                    disabled={sending}
                  />
                </div>
                <Button
                  variant="primary"
                  onClick={sendMessage}
                  loading={sending}
                  disabled={!question.trim()}
                >
                  Send
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">
                  Recent Conversations
                </Text>
                {recentChats.length > 0 ? (
                  <BlockStack gap="200">
                    {recentChats.map((chat) => (
                      <Box key={chat.id} padding="200" background="bg-surface-secondary" borderRadius="100">
                        <BlockStack gap="100">
                          <Text as="p" variant="bodyMd" truncate>
                            <strong>Q:</strong> {chat.question}
                          </Text>
                          <Text as="p" variant="bodySm" tone="subdued" truncate>
                            {new Date(chat.createdAt).toLocaleDateString()}
                          </Text>
                        </BlockStack>
                      </Box>
                    ))}
                  </BlockStack>
                ) : (
                  <Text as="p" variant="bodyMd" tone="subdued">
                    No recent conversations
                  </Text>
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">
                  Quick Actions
                </Text>
                <BlockStack gap="100">
                  <Button
                    variant="plain"
                    textAlign="left"
                    onClick={() => setQuestion("What are my top-selling products this month?")}
                  >
                    📊 View top products
                  </Button>
                  <Button
                    variant="plain"
                    textAlign="left"
                    onClick={() => setQuestion("How can I improve my store's conversion rate?")}
                  >
                    🎯 Improve conversions
                  </Button>
                  <Button
                    variant="plain"
                    textAlign="left"
                    onClick={() => setQuestion("What inventory should I restock?")}
                  >
                    📦 Inventory recommendations
                  </Button>
                  <Button
                    variant="plain"
                    textAlign="left"
                    onClick={() => setQuestion("Analyze my customer demographics")}
                  >
                    👥 Customer insights
                  </Button>
                </BlockStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">
                  AI Configuration
                </Text>
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd">Max Tokens:</Text>
                    <Text as="span" variant="bodyMd">{shopConfig?.maxTokens || 1000}</Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd">Temperature:</Text>
                    <Text as="span" variant="bodyMd">{shopConfig?.temperature || 0.7}</Text>
                  </InlineStack>
                </BlockStack>
                <Button url="/app/config" variant="plain">
                  Adjust Settings
                </Button>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}