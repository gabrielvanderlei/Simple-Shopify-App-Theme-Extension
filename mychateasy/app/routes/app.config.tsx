import { useState, useEffect } from "react";
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
  Checkbox,
  RangeSlider,
  InlineStack,
  Banner,
  List,
  Link,
  Box,
  Badge,
  Spinner,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  return json({
    shopDomain: session.shop
  });
};

export default function ConfigPage() {
  const { shopDomain } = useLoaderData<typeof loader>();
  const shopify = useAppBridge();

  // Estados
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState({
    openaiApiKey: "",
    chatEnabled: false,
    maxTokens: 1000,
    temperature: 0.7,
  });
  const [showApiKey, setShowApiKey] = useState(false);

  // Carregar configuração ao montar o componente
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/config');
      const data = await response.json();
      
      if (data.success) {
        setConfig(data.config);
      } else {
        shopify.toast.show("Failed to load configuration", { isError: true });
      }
    } catch (error) {
      console.error('Load config error:', error);
      shopify.toast.show("Error loading configuration", { isError: true });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      const data = await response.json();
      
      if (data.success) {
        shopify.toast.show("Configuration saved successfully!");
        setConfig(data.config);
      } else {
        shopify.toast.show(`Failed to save: ${data.error}`, { isError: true });
      }
    } catch (error) {
      console.error('Save config error:', error);
      shopify.toast.show("Error saving configuration", { isError: true });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    if (!config.openaiApiKey) {
      shopify.toast.show("Please enter an API key first", { isError: true });
      return;
    }

    try {
      setTesting(true);
      
      const response = await fetch("/api/test-openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: config.openaiApiKey }),
      });

      if (response.ok) {
        shopify.toast.show("✅ Connection successful!");
      } else {
        const errorData = await response.json();
        shopify.toast.show(`❌ Connection failed: ${errorData.error}`, { isError: true });
      }
    } catch (error) {
      shopify.toast.show("❌ Error testing connection", { isError: true });
    } finally {
      setTesting(false);
    }
  };

  const hasApiKey = config.openaiApiKey.length > 0;

  if (loading) {
    return (
      <Page>
        <TitleBar title="AI Configuration" />
        <Card>
          <BlockStack gap="300" align="center">
            <Spinner size="large" />
            <Text as="p" variant="bodyMd">Loading configuration...</Text>
          </BlockStack>
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <TitleBar title="AI Configuration" />
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Card>
              <BlockStack gap="500">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    OpenAI Configuration
                  </Text>
                  <Badge tone={hasApiKey ? "success" : "warning"}>
                    {hasApiKey ? "API Key Configured" : "Setup Required"}
                  </Badge>
                </InlineStack>
                
                <Text as="p" variant="bodyMd" tone="subdued">
                  Store: {shopDomain}
                </Text>
                
                <TextField
                  label="OpenAI API Key"
                  value={config.openaiApiKey}
                  onChange={(value) => setConfig({...config, openaiApiKey: value})}
                  type={showApiKey ? "text" : "password"}
                  placeholder="sk-..."
                  autoComplete="off"
                  helpText={
                    <span>
                      Get your API key from{" "}
                      <Link url="https://platform.openai.com/api-keys" target="_blank">
                        OpenAI Platform
                      </Link>
                    </span>
                  }
                  suffix={
                    <Button
                      variant="plain"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? "Hide" : "Show"}
                    </Button>
                  }
                />

                <InlineStack gap="300">
                  <Button 
                    onClick={testConnection} 
                    disabled={!hasApiKey}
                    loading={testing}
                  >
                    Test Connection
                  </Button>
                  <Button
                    variant="primary"
                    loading={saving}
                    onClick={saveConfig}
                  >
                    Save Configuration
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="500">
                <Text as="h2" variant="headingMd">
                  Chat Settings
                </Text>

                <Checkbox
                  label="Enable AI Chat"
                  checked={config.chatEnabled}
                  onChange={(checked) => setConfig({...config, chatEnabled: checked})}
                  helpText="Allow users to chat with AI about store data"
                />

                <TextField
                  label="Max Tokens"
                  type="number"
                  value={config.maxTokens.toString()}
                  onChange={(value) => setConfig({...config, maxTokens: parseInt(value) || 1000})}
                  helpText="Maximum tokens for AI responses (100-4000)"
                  autoComplete="off"
                />

                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd">
                    Temperature: {config.temperature} (Creativity level)
                  </Text>
                  <RangeSlider
                    label="Temperature"
                    value={config.temperature}
                    onChange={(value) => setConfig({...config, temperature: value})}
                    min={0}
                    max={1}
                    step={0.1}
                    output
                    helpText="0 = Focused and deterministic, 1 = Creative and random"
                  />
                </BlockStack>
              </BlockStack>
            </Card>

            {/* Status Card */}
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingMd">
                  Current Configuration
                </Text>
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">API Key:</Text>
                      <Badge tone={hasApiKey ? "success" : "warning"}>
                        {hasApiKey ? "Configured" : "Not Set"}
                      </Badge>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">Chat Enabled:</Text>
                      <Badge tone={config.chatEnabled ? "success" : "subdued"}>
                        {config.chatEnabled ? "Yes" : "No"}
                      </Badge>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">Max Tokens:</Text>
                      <Text as="span" variant="bodyMd">{config.maxTokens}</Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">Temperature:</Text>
                      <Text as="span" variant="bodyMd">{config.temperature}</Text>
                    </InlineStack>
                  </BlockStack>
                </Box>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="500">
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Setup Status
                </Text>
                <List type="bullet">
                  <List.Item>
                    {hasApiKey ? "✅" : "❌"} OpenAI API Key {hasApiKey ? "Configured" : "Missing"}
                  </List.Item>
                  <List.Item>
                    {config.chatEnabled ? "✅" : "❌"} Chat {config.chatEnabled ? "Enabled" : "Disabled"}
                  </List.Item>
                  <List.Item>
                    🔧 Database Connected
                  </List.Item>
                </List>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Getting Started
                </Text>
                <List type="number">
                  <List.Item>
                    <Link url="https://platform.openai.com/signup" target="_blank">
                      Create OpenAI account
                    </Link>
                  </List.Item>
                  <List.Item>
                    <Link url="https://platform.openai.com/api-keys" target="_blank">
                      Generate API key
                    </Link>
                  </List.Item>
                  <List.Item>
                    Enter API key and test connection
                  </List.Item>
                  <List.Item>
                    Enable chat and save settings
                  </List.Item>
                  <List.Item>
                    <Link url="/app/chat" removeUnderline>
                      Try the AI chat
                    </Link>
                  </List.Item>
                </List>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Next Steps
                </Text>
                <Text as="p" variant="bodyMd">
                  Once configured, you can:
                </Text>
                <List type="bullet">
                  <List.Item>Chat with AI about your store</List.Item>
                  <List.Item>Get product recommendations</List.Item>
                  <List.Item>Analyze customer data</List.Item>
                  <List.Item>Optimize store performance</List.Item>
                </List>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}