import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { session } = await authenticate.admin(request);
    
    // Buscar configuração
    let shopConfig = null;
    let recentChats: any[] = [];
    
    try {
      shopConfig = await prisma.shopConfiguration.findUnique({
        where: { shop: session.shop }
      });

      recentChats = await prisma.chatHistory.findMany({
        where: { shop: session.shop },
        orderBy: { createdAt: 'desc' },
        take: 10
      });
    } catch (dbError) {
      console.log("Database not ready, using defaults");
    }

    const isConfigured = Boolean(shopConfig?.openaiApiKey && shopConfig?.chatEnabled);

    return json({
      success: true,
      shopConfig: shopConfig || { openaiApiKey: "", chatEnabled: false, maxTokens: 1000, temperature: 0.7 },
      recentChats: recentChats || [],
      isConfigured
    });
  } catch (error) {
    console.error("Chat loader error:", error);
    return json({ 
      success: false, 
      error: "Failed to load chat data",
      shopConfig: { openaiApiKey: "", chatEnabled: false, maxTokens: 1000, temperature: 0.7 },
      recentChats: [],
      isConfigured: false
    }, { status: 500 });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { session, admin } = await authenticate.admin(request);
    const data = await request.json();
    const { question } = data;

    if (!question) {
      return json({ 
        success: false, 
        error: "Question is required" 
      }, { status: 400 });
    }

    // Buscar configuração
    const shopConfig = await prisma.shopConfiguration.findUnique({
      where: { shop: session.shop }
    });

    if (!shopConfig?.openaiApiKey || !shopConfig?.chatEnabled) {
      return json({ 
        success: false, 
        error: "OpenAI is not configured. Please go to Configuration first." 
      }, { status: 400 });
    }

    // Buscar dados da loja para contexto
    const [productsResponse, ordersResponse, shopResponse] = await Promise.all([
      admin.graphql(`
        query {
          products(first: 5) {
            edges {
              node {
                id
                title
                vendor
                totalInventory
                createdAt
              }
            }
          }
        }
      `),
      admin.graphql(`
        query {
          orders(first: 5) {
            edges {
              node {
                id
                name
                totalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                createdAt
              }
            }
          }
        }
      `),
      admin.graphql(`
        query {
          shop {
            name
            email
            currencyCode
            plan {
              displayName
            }
          }
        }
      `)
    ]);

    const productsData = await productsResponse.json();
    const ordersData = await ordersResponse.json();
    const shopData = await shopResponse.json();

    // Preparar contexto para OpenAI
    const storeContext = {
      shop: shopData.data.shop,
      products: productsData.data.products.edges.map((edge: any) => edge.node),
      orders: ordersData.data.orders.edges.map((edge: any) => edge.node),
    };

    // Chamar OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${shopConfig.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a helpful AI assistant for a Shopify store named "${storeContext.shop.name}". You have access to the store's data and should provide helpful insights and recommendations. Store context: ${JSON.stringify(storeContext, null, 2)}`
          },
          {
            role: 'user',
            content: question
          }
        ],
        max_tokens: shopConfig.maxTokens,
        temperature: shopConfig.temperature,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || openaiResponse.statusText}`);
    }

    const openaiData = await openaiResponse.json();
    const answer = openaiData.choices[0]?.message?.content || "I couldn't generate a response.";

    // Salvar no histórico
    await prisma.chatHistory.create({
      data: {
        shop: session.shop,
        question,
        answer,
      },
    });

    return json({
      success: true,
      answer,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return json({ 
      success: false,
      error: error instanceof Error ? error.message : "Failed to process chat"
    }, { status: 500 });
  }
};