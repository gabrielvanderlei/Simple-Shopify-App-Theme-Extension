// app/routes/app._index.tsx - Versão simples SEM Prisma
import { useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  List,
  Link,
  InlineStack,
  Icon,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { ChatIcon, SettingsIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  return json({
    shopDomain: session.shop
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const color = ["Red", "Orange", "Yellow", "Green"][
    Math.floor(Math.random() * 4)
  ];
  
  const response = await admin.graphql(
    `#graphql
      mutation populateProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
          }
        }
      }`,
    {
      variables: {
        product: {
          title: `${color} Snowboard`,
        },
      },
    },
  );
  
  const responseJson = await response.json();
  const product = responseJson.data!.productCreate!.product!;
  const variantId = product.variants.edges[0]!.node!.id!;

  const variantResponse = await admin.graphql(
    `#graphql
    mutation shopifyRemixTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`,
    {
      variables: {
        productId: product.id,
        variants: [{ id: variantId, price: "100.00" }],
      },
    },
  );

  const variantResponseJson = await variantResponse.json();

  return {
    product: responseJson!.data!.productCreate!.product,
    variant: variantResponseJson!.data!.productVariantsBulkUpdate!.productVariants,
  };
};

export default function Index() {
  const { shopDomain } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const isLoading = ["loading", "submitting"].includes(fetcher.state) && fetcher.formMethod === "POST";
  const productId = fetcher.data?.product?.id.replace("gid://shopify/Product/", "");

  useEffect(() => {
    if (productId) {
      shopify.toast.show("Product created");
    }
  }, [productId, shopify]);

  const generateProduct = () => fetcher.submit({}, { method: "POST" });

  return (
    <Page>
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    🤖 AI Store Assistant
                  </Text>
                  <Text variant="bodyMd" as="p">
                    Welcome to your AI-powered store assistant! Configure your OpenAI API key 
                    to start getting intelligent insights about your store data.
                  </Text>
                  <Text variant="bodyMd" as="p">
                    <strong>Store:</strong> {shopDomain}
                  </Text>
                </BlockStack>

                <Layout>
                  <Layout.Section>
                    <Card>
                      <BlockStack gap="300">
                        <InlineStack gap="200" align="start">
                          <Icon source={SettingsIcon} tone="base" />
                          <Text as="h3" variant="headingMd">
                            Configuration
                          </Text>
                        </InlineStack>
                        <Text as="p" variant="bodyMd">
                          Set up your OpenAI API key and customize chat settings 
                          to enable AI-powered store insights.
                        </Text>
                        <Button url="/app/config" variant="primary">
                          Configure OpenAI
                        </Button>
                      </BlockStack>
                    </Card>
                  </Layout.Section>

                  <Layout.Section>
                    <Card>
                      <BlockStack gap="300">
                        <InlineStack gap="200" align="start">
                          <Icon source={ChatIcon} tone="base" />
                          <Text as="h3" variant="headingMd">
                            AI Chat
                          </Text>
                        </InlineStack>
                        <Text as="p" variant="bodyMd">
                          Chat with AI about your store data, get insights, 
                          and receive recommendations for growth.
                        </Text>
                        <Button url="/app/chat" variant="primary">
                          Start Chatting
                        </Button>
                      </BlockStack>
                    </Card>
                  </Layout.Section>
                </Layout>

                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">
                    What you can ask your AI assistant:
                  </Text>
                  <List type="bullet">
                    <List.Item>
                      "What are my top-selling products this month?"
                    </List.Item>
                    <List.Item>
                      "Show me customer demographics and behavior patterns"
                    </List.Item>
                    <List.Item>
                      "How can I improve my conversion rate?"
                    </List.Item>
                    <List.Item>
                      "What inventory should I restock based on trends?"
                    </List.Item>
                    <List.Item>
                      "Analyze my store performance and suggest improvements"
                    </List.Item>
                  </List>
                </BlockStack>

                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">
                    Demo: Generate Test Product
                  </Text>
                  <Text as="p" variant="bodyMd">
                    Test the Shopify GraphQL integration by generating a sample product.
                  </Text>
                  <InlineStack gap="300">
                    <Button loading={isLoading} onClick={generateProduct}>
                      Generate a product
                    </Button>
                    {fetcher.data?.product && (
                      <Button
                        url={`shopify:admin/products/${productId}`}
                        target="_blank"
                        variant="plain"
                      >
                        View product
                      </Button>
                    )}
                  </InlineStack>
                </BlockStack>

                {fetcher.data?.product && (
                  <>
                    <Text as="h3" variant="headingMd">
                      Product Created Successfully!
                    </Text>
                    <Box
                      padding="400"
                      background="bg-surface-active"
                      borderWidth="025"
                      borderRadius="200"
                      borderColor="border"
                      overflowX="scroll"
                    >
                      <pre style={{ margin: 0 }}>
                        <code>
                          {JSON.stringify(fetcher.data.product, null, 2)}
                        </code>
                      </pre>
                    </Box>
                  </>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    App Features
                  </Text>
                  <List>
                    <List.Item>
                      <Link url="/app/config" removeUnderline>
                        🔧 OpenAI Configuration
                      </Link>
                    </List.Item>
                    <List.Item>
                      <Link url="/app/chat" removeUnderline>
                        💬 AI Store Chat
                      </Link>
                    </List.Item>
                    <List.Item>
                      🎨 Theme App Extensions
                    </List.Item>
                    <List.Item>
                      📊 Store Analytics
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
                      <Link url="https://platform.openai.com/api-keys" target="_blank">
                        Get your OpenAI API key
                      </Link>
                    </List.Item>
                    <List.Item>
                      Go to Configuration and enter your API key
                    </List.Item>
                    <List.Item>
                      Test the connection and enable chat
                    </List.Item>
                    <List.Item>
                      Start chatting with your AI assistant!
                    </List.Item>
                  </List>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    App Template Info
                  </Text>
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">Framework</Text>
                      <Link url="https://remix.run" target="_blank" removeUnderline>
                        Remix
                      </Link>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">Database</Text>
                      <Link url="https://www.prisma.io/" target="_blank" removeUnderline>
                        Prisma
                      </Link>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">AI</Text>
                      <Link url="https://openai.com" target="_blank" removeUnderline>
                        OpenAI
                      </Link>
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}